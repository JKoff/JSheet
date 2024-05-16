const BEGIN = Symbol('BEGIN');

function parseToken(token) {
    if (!isNaN(parseInt(token, 10))) {
        return parseInt(token, 10);
    } else {
        return token;
    }
}

function tokenize(code) {
    const tokens = [BEGIN];
    let i = 0;
    while (i < code.length) {
        if (code[i] === ' ') {
            i++;
        } else if (code[i] === '(' || code[i] === ')') {
            tokens.push(code[i]);
            i++;
        } else {
            let j = i;
            while (j < code.length && code[j] !== ' ' && code[j] !== '(' && code[j] !== ')') {
                j++;
            }
            tokens.push(parseToken(code.slice(i, j)));
            i = j;
        }
    }
    return tokens;
}

// https://code.jsoftware.com/wiki/NuVoc
function classify(token) {
    if (token === '>:') {
        return 'V';
    } else {
        return 'N';
    }
}

function monad(token) {
    if (token === '>:') {
        return x => x + 1;
    } else {
        return null;
    }
}

function reduce(stack) {
    if (stack.length <= 1) {
        return false;
    }
    /*
        | leftmost stack word	| other stack words | action |
        | § =. =: (             | V | N | anything  | 0 Monad |
    */
    if ([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 && classify(stack[1]) === 'V' && classify(stack[2]) === 'N' && monad(stack[1]) !== null) {
        stack.splice(1, 2, monad(stack[1])(stack[2]));
        return true;
    }

    return false;
}

function runJFragment(code) {
    const tokens = tokenize(code);
    console.log("Tokens", tokens);

    // Parsing and execution proceed simultaneously, one token at a time.
    // https://code.jsoftware.com/wiki/Vocabulary/Parsing
    const stack = [];
    while (tokens.length > 0) {
        const tail = tokens.pop();
        stack.splice(0, 0, tail);
        while (reduce(stack)) {}
    }
    console.log('Stack', stack);

    return stack[1];
};

if (typeof module !== 'undefined') {
    module.exports = runJFragment;
}
