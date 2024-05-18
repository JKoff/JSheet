let renderState = { focus: null, dirty: new Set() };
let refreshTimeout = null;

function renderCell(state, row, col, focus) {
    const cell = document.createElement(focus ? 'textarea' : 'div');
    cell.id = `R${row}C${col}`;
    cell.className = `cell`;
    cell.dataset.row = row;
    cell.dataset.col = col;
    if (focus) {
        cell.value = state.code[cell.id] || state.display[cell.id] || '';
    } else {
        if (state.code[cell.id]) {
            cell.innerHTML = `
                <span class="code">${state.code[cell.id]}</span>
                ${state.display[cell.id] ? `<span class="display">${state.display[cell.id]}</span>` : ''}
            `;
        } else if (state.display[cell.id]) {
            cell.innerHTML = `<span class="display">${state.display[cell.id]}</span>`;
        } else {
            cell.innerHTML = '';
        }
    }

    cell.dataset.populated = !!(state.code[cell.id] || state.display[cell.id]);
    cell.dataset.computed = !!(!state.code[cell.id] && state.display[cell.id] && state.parent[cell.id]);
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

function requestRefresh(cell) {
    renderState.dirty.add(cell);
    if (refreshTimeout === null) {
        refreshTimeout = setTimeout(refresh, 0);
    }
}

function refresh() {
    for (let cell of renderState.dirty) {
        const row = parseInt(cell.match(/R(\d+)/)[1], 10);
        const col = parseInt(cell.match(/C(\d+)/)[1], 10);
        const focus = cell === renderState.focus;
        const el = document.querySelector(`#${cell}`);
        const newEl = renderCell(state, el.dataset.row, el.dataset.col, focus);
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
    rootEl.addEventListener('click', e => {
        if (e.target.classList.contains('cell')) {
            requestFocus(e.target.id);
        }
        if (e.target.parentNode.classList.contains('cell')) {
            requestFocus(e.target.parentNode.id);
        }
    });

    rootEl.addEventListener('keydown', e => {
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
}

if (typeof module !== 'undefined') {
    module.exports = { renderGrid, bindGridListeners };
}
