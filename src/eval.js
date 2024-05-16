const BEGIN = Symbol('BEGIN');

const verbs = {}, monads = {}, dyads = {};
function registerVerb(name, monad, dyad) {
    verbs[name] = true;
    if (monad) {
        monads[name] = monad;
    }
    if (dyad) {
        dyads[name] = dyad;
    }
}
registerVerb('>:', x => x + 1, null);
registerVerb('+', null, (x, y) => x + y);

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
            tokens.push(code.slice(i, j));
            i = j;
        }
    }
    return tokens;
}

// https://code.jsoftware.com/wiki/NuVoc
function classify(token) {
    if (verbs[token] !== undefined) {
        return 'V';
    } else {
        return 'N';
    }
}

function reduce(stack) {
    if (stack.length <= 1) {
        return false;
    }
    /*
        | leftmost stack word	| other stack words | action |
        | § =. =: (             | V | N | anything  | 0 Monad |
        | § =. =: ( A V N       | V | V | N         | 1 Monad |
        | § =. =: ( A V N       | N | V | N         | 2 Dyad |
    */
    if ([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 && classify(stack[1]) === 'V' && classify(stack[2]) === 'N' &&
                monads[stack[1]]) {
        stack.splice(1, 2, monads[stack[1]](stack[2]));
        return true;
    } else if (([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 || ['A', 'V', 'N'].indexOf(classify(stack[0])) !== -1) &&
                classify(stack[1]) === 'V' && classify(stack[2]) === 'V' && classify(stack[3]) === 'N' &&
                monads[stack[2]]) {
        stack.splice(2, 2, monads[stack[2]](stack[3]));
        return true;
    } else if (([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 || ['A', 'V', 'N'].indexOf(classify(stack[0])) !== -1) &&
                classify(stack[1]) === 'N' && classify(stack[2]) === 'V' && classify(stack[3]) === 'N' &&
                dyads[stack[2]]) {
        stack.splice(1, 3, dyads[stack[2]](stack[1], stack[3]));
        return true;
    }

    return false;
}

function evaluateToken(token, lookupFn) {
    if (token === BEGIN) {
        return token;
    } else if (!isNaN(parseInt(token, 10))) {
        return parseInt(token, 10);
    } else if (verbs[token] !== undefined) {
        return token;
    } else if (lookupFn(token) !== null) {
        return lookupFn(token);
    } else {
        throw new Error(`Unknown symbol: ${token}`);
    }
}

function runJFragment(code, lookupFn) {
    const tokens = tokenize(code);
    console.log("Tokens", tokens);

    // Parsing and execution proceed simultaneously, one token at a time.
    // https://code.jsoftware.com/wiki/Vocabulary/Parsing
    const stack = [];
    while (tokens.length > 0) {
        const tail = tokens.pop();
        const tail2 = evaluateToken(tail, lookupFn);
        console.log('Parsed', tail, 'to', tail2);
        stack.splice(0, 0, tail2);
        while (reduce(stack)) {
            console.log('Stack', stack);
        }
    }

    return stack[1];
};

if (typeof module !== 'undefined') {
    module.exports = runJFragment;
}
