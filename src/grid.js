function renderCell(state, row, col, focus) {
    const cell = document.createElement(focus ? 'textarea' : 'div');
    cell.id = `R${row}C${col}`;
    cell.className = `cell`;
    cell.dataset.row = row;
    cell.dataset.col = col;
    if (focus) {
        cell.value = state.code[cell.id] || state.display[cell.id] || '';
    } else {
        cell.innerHTML = state.code[cell.id] || state.display[cell.id] || '';
    }

    cell.dataset.populated = !!state.code[cell.id];
    cell.dataset.computed = !!(state.display[cell.id] && !state.code[cell.id]);
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

if (typeof module !== 'undefined') {
    module.exports = { renderGrid };
}
