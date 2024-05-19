let renderState = {
    focus: null,
    dirty: new Set(),
    selection: {
        mousedown: false,
        startRow: null,
        startCol: null,
        endRow: null,
        endCol: null,
    },
};
let refreshTimeout = null;

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
        cell.value = st.code || st.display || '';
    } else {
        if (st.code) {
            cell.innerHTML = `
                <span class="code">${st.code}</span>
                ${st.display ? `<span class="display">${st.display}</span>` : ''}
            `;
        } else if (st.display) {
            cell.innerHTML = `<span class="display">${st.display}</span>`;
        }
    }

    // Cases:
    // 1. Cell is empty
    if (st.code === undefined) cell.dataset.type = 'empty';
    // 2. Cell contains constant
    if (st.result && `${st.result.data[0]}` === st.code) cell.dataset.type = 'constant';
    // 3. Cell evaluates to atom
    if (st.result && `${st.result.data[0]}` !== st.code) cell.dataset.type = 'atom';
    // 4. Cell evaluates to list or table
    if (st.result && st.result.shape.length === 1) cell.dataset.type = 'list';
    if (st.result && st.result.shape.length > 1) cell.dataset.type = 'table';
    // 5. Cell was parented by another cell
    if (st.parent) cell.dataset.type = 'parented';
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
    renderState.dirty.add(cell);
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
    refreshTimeout = null;
}

function bindGridListeners(rootEl, commitCell, deleteCell) {
    rootEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            requestClearSelect();
        }

        const focusEl = document.querySelector('.cell:focus');
        if (!focusEl) {
            return;
        }

        const row = parseInt(focusEl.dataset.row, 10);
        const col = parseInt(focusEl.dataset.col, 10);
        if (e.key === 'Enter') {
            commitCell(focusEl);
            requestBlur(focusEl.id);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            requestBlur(focusEl.id);
            e.preventDefault();
        } else if (e.key === 'Tab') {
            if (e.shiftKey) {
                requestBlur(focusEl.id);
                if (focusCol >= 0) {
                    requestFocus(`R${row}C${col - 1}`);
                }
            } else {
                commitCell(focusEl);
                requestBlur(focusEl.id);
                requestFocus(`R${row}C${col + 1}`);
            }
            e.preventDefault();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            commitCell(focusEl);
            if (e.key === 'ArrowUp') {
                requestBlur(focusEl.id);
                requestFocus(`R${row - 1}C${col}`);
            } else if (e.key === 'ArrowDown') {
                requestBlur(focusEl.id);
                requestFocus(`R${row + 1}C${col}`);
            } else if (e.key === 'ArrowLeft') {
                requestBlur(focusEl.id);
                requestFocus(`R${row}C${col - 1}`);
            } else if (e.key === 'ArrowRight') {
                requestBlur(focusEl.id);
                requestFocus(`R${row}C${col + 1}`);
            }
            e.preventDefault();
        } else if (e.key === 'Backspace' && e.shiftKey) {
            deleteCell(focusEl);
            if (col > 0) {
                requestBlur(focusEl.id);
                requestFocus(`R${row}C${col - 1}`);
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
        renderState.selection.mousedown = true;

        requestClearSelect();

        const focusEl = document.querySelector('.cell:focus');
        if (focusEl && focusEl.classList.contains('cell')) {
            requestBlur(focusEl.id);
        }

        if (e.target.classList.contains('cell')) {
            requestSelect(e.target.id);
            e.preventDefault();
        }
    });
    rootEl.addEventListener('mouseover', e => {
        if (renderState.selection.mousedown && e.target.classList.contains('cell')) {
            requestSelect(e.target.id);
            e.preventDefault();
        }
    });
    rootEl.addEventListener('mouseup', e => {
        renderState.selection.mousedown = false;

        if (Array.from(allSelected()).length > 1) {
            e.preventDefault();
        } else if (e.target.classList.contains('cell')) {
            requestClearSelect();
            requestFocus(e.target.id);
        } else if (e.target.parentNode.classList.contains('cell')) {
            requestClearSelect();
            requestFocus(e.target.parentNode.id);
        }
    });
}

if (typeof module !== 'undefined') {
    module.exports = { renderGrid, bindGridListeners };
}
