# JSheet

Web based spreadsheet application. Client-only for now, i.e. there's no backend or persistence mechanism beyond LocalStorage.

Reimplements a subset of the J language in JavaScript. Any cell that evaluates as a J sentence will be expanded to adjacent cells. Code cells can reference one another while preserving the J array that they evaluated to, i.e. you don't need to reference the individual expanded cells like a typical spreadsheet.

Formatting works on the basis of dimensional analysis, i.e. a cell can be labeled with a unit such as $USD, and J evaluation will properly propagate these units through operations such as multiplication.