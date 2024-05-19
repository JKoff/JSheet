const NULL_TYPE = '&#8709;';

let renderState = {
    focus: null,
    dirty: new Set(),
    lastClick: {
        timeMs: null,
        id: null,
    },
    selection: {
        mousedown: false,
        startRow: null,
        startCol: null,
        endRow: null,
        endCol: null,
    },
    contextual: null,
    onCellUnitChange: () => {},
    onCellFormatChange: () => {},
};
let refreshTimeout = null;

function bindCellUnitChange(fn) {
    renderState.onCellUnitChange = fn;
}

function bindCellFormatChange(fn) {
    renderState.onCellFormatChange = fn;
}

const parseIdRE = /R(?<row>[\-0-9]+)C(?<col>[\-0-9]+)/;
function parseId(id) {
    let res;
    if ((res = parseIdRE.exec(id)) !== null) {
        return { row: parseInt(res.groups.row, 10), col: parseInt(res.groups.col, 10) };
    }
    return null;
}

function isSelected(row, col) {
    const { startRow, startCol, endRow, endCol } = renderState.selection;
    return startRow !== null && (
        Math.min(startRow, endRow) <= row && row <= Math.max(startRow, endRow) &&
        Math.min(startCol, endCol) <= col && col <= Math.max(startCol, endCol)
    );
}

function* allSelected() {
    const { startRow, startCol, endRow, endCol } = renderState.selection;
    for (let i = Math.min(startRow, endRow); i <= Math.max(startRow, endRow); i++) {
        for (let j = Math.min(startCol, endCol); j <= Math.max(startCol, endCol); j++) {
            yield `R${i}C${j}`;
        }
    }
}

function cellType(st) {
    // Cases:
    // 6. Cell does not exist
    if (st === undefined) return 'no cell';
    // 5. Cell was parented by another cell
    if (st.parent) return 'parented';
    // 1. Cell is empty
    if (st.code === undefined) return 'empty';
    // 2. Cell contains constant
    if (st.result && `${st.result.data[0]}` === st.code) return 'constant';
    // 3. Cell evaluates to atom
    if (st.result && `${st.result.data[0]}` !== st.code) return 'atom';
    // 4. Cell evaluates to list or table
    if (st.result && st.result.shape.length === 1) return 'list';
    if (st.result && st.result.shape.length > 1) return 'table';
    return 'unknown';
}

function displayCell(st) {
    if (st.result && st.result.data.length >= 1) {
        if ((st.format || {})['%'] && Object.keys(st.result.unit || {}).length === 0) {
            return new Intl.NumberFormat('en-US', { style: 'percent' }).format(st.result.data[0]);
        } else if ((st.result.unit || {})['USD']) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(st.result.data[0]);
        } else if ((st.result.unit || {})['CAD']) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'CAD' }).format(st.result.data[0]);
        } else if ((st.result.unit || {})['EUR']) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(st.result.data[0]);
        } else {
            return `${st.result.data[0]}`;
        }
    } else if (st.code) {
        return st.code;
    }
    return '';
}

function displayUnit(unit) {
    if (Object.entries(unit).length === 0) {
        return NULL_TYPE;
    }
    return Object.entries(unit).map(([unit, coeff]) => {
        return `<span>${unit}${coeff !== 1 ? `<sup>${coeff}</sup>` : ''}</span>`;
    }).join(' • ');
}

function renderCell(state, row, col, focus, selected) {
    const cell = document.createElement(focus ? 'textarea' : 'div');
    cell.id = `R${row}C${col}`;
    cell.className = `cell ${selected ? 'selected' : ''}`;
    cell.dataset.row = row;
    cell.dataset.col = col;

    const st = state.cells[cell.id];
    if (st === undefined) {
        cell.innerHTML = '';
        return cell;
    }

    if (focus) {
        cell.value = st.code || '';
    } else {
        cell.innerHTML = displayCell(st);
    }

    cell.dataset.type = cellType(st);

    return cell;
}

function renderGrid(state) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 40; j++) {
            grid.appendChild(renderCell(state, i, j, /*focus=*/false));
        }
    }
    return grid;
}

function requestFocus(cell) {
    if (cell === renderState.focus) {
        return;
    }
    if (renderState.focus !== null) {
        requestBlur(renderState.focus);
    }
    if (renderState.contextual !== null) {
        renderState.contextual = null;
        requestRefresh(null);
    }
    renderState.focus = cell;
    requestRefresh(cell);
}

function requestBlur(cell) {
    renderState.focus = null;
    requestRefresh(cell);
}

function requestSelect(cell) {
    const { row, col } = parseId(cell);
    if (renderState.selection.startRow === null) {
        renderState.selection.startRow = renderState.selection.endRow = row;
        renderState.selection.startCol = renderState.selection.endCol = col;
        for (const id of allSelected()) requestRefresh(id);
        return;
    }
    for (const id of allSelected()) requestRefresh(id);
    renderState.selection.endRow = row;
    renderState.selection.endCol = col;
    for (const id of allSelected()) requestRefresh(id);

}

function requestClearSelect() {
    for (const id of allSelected()) requestRefresh(id);
    renderState.selection.startRow = renderState.selection.endRow = null;
    renderState.selection.startCol = renderState.selection.endCol = null;
}

function requestRefresh(cell) {
    if (cell !== null) {
        renderState.dirty.add(cell);
    }
    if (refreshTimeout === null) {
        refreshTimeout = setTimeout(refresh, 0);
    }
}

function refresh() {
    for (let cell of renderState.dirty) {
        const { row, col } = parseId(cell);
        const focus = cell === renderState.focus;
        const selected = isSelected(row, col);
        const el = document.querySelector(`#${cell}`);
        const newEl = renderCell(state, el.dataset.row, el.dataset.col, focus, selected);
        el.replaceWith(newEl);
        if (focus) {
            newEl.focus();
        } else if (renderState.focus === null && document.activeElement === newEl) {
            newEl.blur();
        }
    }
    renderState.dirty.clear();

    if (renderState.contextual === null) {
        document.getElementById('contextual').style.display = 'none';
    } else {
        const { x, y, row, col } = renderState.contextual;

        const root = document.createElement('div');
        root.id = 'contextual';
        root.style.display = 'grid';
        root.style.top = `${y}px`;
        root.style.left = `${x}px`;

        const id = `R${row}C${col}`;

        const infos = document.createElement('div');
        infos.className = 'infos';

        const st = state.cells[id];
        const selected = renderState.selection.startRow !== renderState.selection.endRow ?
            `R${Math.min(renderState.selection.startRow, renderState.selection.endRow)}C${Math.min(renderState.selection.startCol, renderState.selection.endCol)}:R${Math.max(renderState.selection.startRow, renderState.selection.endRow)}C${Math.max(renderState.selection.startCol, renderState.selection.endCol)}` :
            id;
        const effectiveUnit = ((st || {}).result || {}).unit || {};
        for (const info of [selected, displayUnit(effectiveUnit), cellType(state.cells[id])]) {
            const infoEl = document.createElement('span');
            infoEl.className = 'info';
            infoEl.innerHTML = info;
            infos.appendChild(infoEl);
        }

        root.appendChild(infos);

        const dimensions = document.createElement('div');
        dimensions.className = 'dimensions';

        for (const dim of [NULL_TYPE, 'USD', 'CAD', 'EUR']) {
            const dimEl = document.createElement('span');
            dimEl.className = `dimension ${effectiveUnit[dim] ? 'active' : ''}`;
            dimEl.innerHTML = dim;
            dimEl.addEventListener('click', () => {
                if (dim === NULL_TYPE) {
                    renderState.onCellUnitChange(id, {});
                } else {
                    renderState.onCellUnitChange(id, Object.fromEntries([[dim, 1]]));
                }
                requestRefresh(null);
            });
            dimensions.appendChild(dimEl);
        }

        root.appendChild(dimensions);

        const formats = document.createElement('div');
        formats.className = 'formats';

        for (const dim of [NULL_TYPE, '%']) {
            const dimEl = document.createElement('span');
            dimEl.className = `format ${((st || {}).format || {})[dim] ? 'active' : ''}`;
            dimEl.innerHTML = dim;
            dimEl.addEventListener('click', () => {
                if (dim === NULL_TYPE) {
                    renderState.onCellFormatChange(id, {});
                } else {
                    renderState.onCellFormatChange(id, Object.fromEntries([[dim, 1]]));
                }
                requestRefresh(null);
            });
            formats.appendChild(dimEl);
        }

        root.appendChild(formats);

        document.getElementById('contextual').replaceWith(root);
    }

    refreshTimeout = null;
}

function bindGridListeners(rootEl, commitCell, deleteCell) {
    rootEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            requestClearSelect();

            renderState.contextual = null;
            requestRefresh(null);
        }

        const focusEl = document.querySelector('textarea.cell:focus');
        const selectEl = (
            !focusEl &&
            renderState.selection.startRow !== null &&
            renderState.selection.startRow === renderState.selection.endRow &&
            renderState.selection.startCol === renderState.selection.endCol &&
            document.getElementById(`R${renderState.selection.startRow}C${renderState.selection.startCol}`)
        );

        if (e.key === 'Enter') {
            if (focusEl) {
                commitCell(focusEl);
                requestBlur(focusEl.id);
            } else if (selectEl) {
                requestFocus(selectEl.id);
            }
            e.preventDefault();
        } else if (e.key === 'Escape') {
            if (focusEl) {
                requestBlur(focusEl.id);
            }
            e.preventDefault();
        } else if (e.key === 'Tab' && focusEl) {
            const row = parseInt(focusEl.dataset.row, 10);
            const col = parseInt(focusEl.dataset.col, 10);
            if (e.shiftKey) {
                requestBlur(focusEl.id);
                if (col >= 0) {
                    requestFocus(`R${row}C${col - 1}`);
                }
            } else {
                commitCell(focusEl);
                requestBlur(focusEl.id);
                requestFocus(`R${row}C${col + 1}`);
            }
            e.preventDefault();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (selectEl) {
                const { row, col } = parseId(selectEl.id);
                if (e.key === 'ArrowUp') {
                    requestClearSelect();
                    requestSelect(`R${row - 1}C${col}`);
                } else if (e.key === 'ArrowDown') {
                    requestClearSelect();
                    requestSelect(`R${row + 1}C${col}`);
                } else if (e.key === 'ArrowLeft') {
                    requestClearSelect();
                    requestSelect(`R${row}C${col - 1}`);
                } else if (e.key === 'ArrowRight') {
                    requestClearSelect();
                    requestSelect(`R${row}C${col + 1}`);
                }
                e.preventDefault();
            }
        } else if (e.key === 'Backspace') {
            if (focusEl && e.shiftKey) {
                const row = parseInt(focusEl.dataset.row, 10);
                const col = parseInt(focusEl.dataset.col, 10);
                deleteCell(focusEl);
                if (col > 0) {
                    requestBlur(focusEl.id);
                    requestFocus(`R${row}C${col - 1}`);
                }
            } else if (selectEl) {
                const { row, col } = parseId(selectEl.id);
                deleteCell(selectEl);
                if (col > 0) {
                    requestClearSelect();
                    requestSelect(`R${row}C${col - 1}`);
                }
            } else if (renderState.selection.startRow !== null) {
                for (const sel of allSelected()) {
                    const el = document.getElementById(sel);
                    if (el) deleteCell(el);
                }
            }
        }
    }, { capture: true });

    rootEl.addEventListener('blur', e => {
        if (e.target.classList.contains('cell')) {
            commitCell(e.target);
            requestBlur(e.target.id);
        }
    });

    rootEl.addEventListener('mousedown', e => {
        if (e.metaKey === false && e.target.classList.contains('cell')) {
            renderState.selection.mousedown = true;

            requestClearSelect();

            const focusEl = document.querySelector('.cell:focus');
            if (focusEl && focusEl.classList.contains('cell')) {
                commitCell(focusEl);
                requestBlur(focusEl.id);
            }

            if (e.target.classList.contains('cell')) {
                requestSelect(e.target.id);
                e.preventDefault();
            }
        }
    });
    rootEl.addEventListener('mouseover', e => {
        if (renderState.selection.mousedown && e.target.classList.contains('cell')) {
            requestSelect(e.target.id);
            e.preventDefault();
        }
    });
    rootEl.addEventListener('mouseup', e => {
        let el = null;
        if (e.target.classList.contains('cell')) {
            el = e.target;
        } else if (e.target.parentNode.classList.contains('cell')) {
            el = e.target.parentNode;
        }

        if (e.metaKey === false) {
            renderState.selection.mousedown = false;

            if (Array.from(allSelected()).length > 1) {
                e.preventDefault();
            } else if (el !== null) {
                requestClearSelect();

                if (el.id === renderState.lastClick.id) {
                    requestFocus(el.id);
                } else {
                    if (renderState.contextual) {
                        renderState.contextual = { x: e.x, y: e.y, row: el.dataset.row, col: el.dataset.col };
                    }
                    requestSelect(el.id);
                    renderState.lastClick.timeMs = +new Date();
                    renderState.lastClick.id = el.id;
                }
            }
        } else if (e.metaKey === true && el !== null) {
            renderState.contextual = { x: e.x, y: e.y, row: el.dataset.row, col: el.dataset.col };
            requestRefresh(null);
            e.preventDefault();
        }
    });
}

if (typeof module !== 'undefined') {
    module.exports = { renderGrid, bindGridListeners, bindCellUnitChange, bindCellFormatChange };
}
