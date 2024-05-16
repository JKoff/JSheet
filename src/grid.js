function renderGrid(state) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 40; j++) {
            const cell = document.createElement('textarea');
            cell.id = `R${i}C${j}`;
            cell.className = `cell`;
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.innerHTML = state[cell.id] || '';
            grid.appendChild(cell);
        }
    }
    return grid;
}

if (typeof module !== 'undefined') {
    module.exports = { renderGrid };
}
