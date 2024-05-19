const BEGIN = Symbol('BEGIN');
const verbs = {}, monads = {}, dyads = {};

// Implements the J array data structure, or something like it.
class JArray {
    constructor(shape, data, unit=null) {
        this.shape = shape;
        this.data = data;
        this.unit = unit;
        if (this.shape.reduce((acc, val) => acc * val, 1) !== this.data.length) {
            throw new Error(`Shape ${JSON.stringify(this.shape)} does not match data length ${this.data.length}`);
        }
    }
    numItems(rank) {
        const frameShape = this.shape.slice(0, this.shape.length - rank);
        return frameShape.reduce((acc, val) => acc * val, 1);
    }
    * frames(rank, repetitions = 1) {
        const itemShape = this.shape.slice(this.shape.length - rank);
        const itemSize = itemShape.reduce((acc, val) => acc * val, 1);

        const frameShape = this.shape.slice(0, this.shape.length - rank);
        const numItems = frameShape.reduce((acc, val) => acc * val, 1);

        for (let j = 0; j < repetitions; j++) {
            for (let i = 0; i < numItems; i++) {
                yield new JArray(itemShape, this.data.slice(i * itemSize, (i + 1) * itemSize), this.unit);
            }
        }
    }
    map(rank, fn) {
        const itemShape = this.shape.slice(this.shape.length - rank);
        const itemSize = itemShape.reduce((acc, val) => acc * val, 1);

        const frameShape = this.shape.slice(0, this.shape.length - rank);
        const frameSize = frameShape.reduce((acc, val) => acc * val, 1);

        const frames = new Array(frameSize).fill(0).map((_, i) => new JArray(itemShape, this.data.slice(i * itemSize, (i + 1) * itemSize), this.unit));
        const processedFrames = frames.map(fn);

        const resultShape = this.shape.slice(0, this.shape.length - rank).concat(...processedFrames[0].shape);
        const result = new JArray(
            resultShape,
            Array.prototype.concat(...processedFrames.map(frame => frame.data)),
            processedFrames.length > 0 ? processedFrames[0].unit : null
        );

        return result;
    }
    only() {
        if (!(this.shape.length === 0 && this.data.length === 1)) {
            throw new Error(`Expected an atom, got ${JSON.stringify(this.shape)} with length ${this.data.length}`);
        }
        return this.data[0];
    }
}

function atom(value, unit) {
    if (value instanceof JArray) {
        throw new Error(`Did not expect a JArray to be passed into atom: ${JSON.stringify(value)}`);
    }
    return new JArray([], [value], unit);
}

class Monad {
    constructor(name, fn, rank) {
        this.name = name;
        this.fn = fn;
        this.rank = rank;
    }
    apply(arg) {
        // console.log('Evaluating Monad', this.name, 'with rank', this.rank, 'on', arg, 'result is', arg.map(this.rank, frame => this.fn(frame)));
        return arg.map(this.rank, frame => this.fn(frame));
    }
}

class Dyad {
    constructor(name, fn, leftRank, rightRank) {
        this.name = name;
        this.fn = fn;
        this.leftRank = leftRank;
        this.rightRank = rightRank;
    }
    apply(left, right) {
        // Agreement rule:
        // If the left and right frames are the same then there is no problem.
        // Otherwise, one frame must be a prefix of the other, and its cells are repeated into its trailing axes to provide the required arguments.

        const leftFS = left.numItems(this.leftRank);
        const rightFS = right.numItems(this.rightRank);

        const leftGen = left.frames(this.leftRank, leftFS < rightFS ? rightFS / leftFS : 1);
        const rightGen = right.frames(this.rightRank, rightFS < leftFS ? leftFS / rightFS : 1);

        const results = [];

        do {
            const leftNext = leftGen.next();
            const rightNext = rightGen.next();

            if (leftNext.done || rightNext.done) {
                break;
            }

            const leftFrame = leftNext.value;
            const rightFrame = rightNext.value;
            
            // if (leftFrame.shape.length !== rightFrame.shape.length) {
            //     throw new Error(`Frame shapes do not match in ${this.name}: ${JSON.stringify(leftFrame.shape)} vs ${JSON.stringify(rightFrame.shape)}`);
            // }

            results.push(this.fn(leftFrame, rightFrame));
        } while (true);

        const result = new JArray(
            leftFS > rightFS ?
                left.shape.slice(0, left.shape.length - this.leftRank).concat(...results[0].shape) :
                right.shape.slice(0, right.shape.length - this.rightRank).concat(...results[0].shape),
            Array.prototype.concat(...results.map(frame => frame.data)),
            results.length > 0 ? results[0].unit : null
        );
        // console.log('Evaluating Dyad', this.name, 'with left rank', this.leftRank, 'on', left, 'and right rank', this.rightRank, 'on', right, 'result is', result);

        return result;
    }
}

class VerbBuilder {
    constructor(name) {
        this.name = name;
    }
    withMonad(monad, rank) {
        this.monad = new Monad(this.name, monad, rank);
        return this;
    }
    withDyad(dyad, leftRank, rightRank) {
        this.dyad = new Dyad(this.name, dyad, leftRank, rightRank);
        return this;
    }
    register() {
        verbs[this.name] = this;
        if (this.monad) monads[this.name] = this.monad;
        if (this.dyad) dyads[this.name] = this.dyad;
    }
}

function multiplyUnits(c, arg) {
    return Object.fromEntries(Object.entries(arg || {}).map(([k, v]) => {
        return [k, c * v];
    }));
}

function sumUnits(lhs, rhs) {
    const res = {};
    Object.entries(lhs || {}).forEach(([k, v]) => res[k] = (res[k] || 0) + v);
    Object.entries(rhs || {}).forEach(([k, v]) => res[k] = (res[k] || 0) + v);
    return res;
}

new VerbBuilder('i.').withMonad(x => new JArray([x.only()], new Array(x.only()).fill(0).map((_, idx) => idx), x.unit), 1).register();
new VerbBuilder('>:').withMonad(x => atom(x.only() + 1, x.unit), 0).register();

new VerbBuilder('%').withMonad(x => atom(1 / x.only(), multiplyUnits(-1, x.unit)), 0).register();
new VerbBuilder('%').withDyad((x, y) => atom(x.only() / y.only(), sumUnits(x.unit, multiplyUnits(-1, y.unit))), 0, 0).register();

new VerbBuilder('+').withDyad((x, y) => atom(x.only() + y.only(), x.unit), 0, 0).register();
new VerbBuilder('*').withDyad((x, y) => atom(x.only() * y.only(), sumUnits(x.unit, y.unit)), 0, 0).register();
new VerbBuilder(',').withDyad((x, y) => {
    const newShape = new Array(Math.max(x.shape.length, y.shape.length, 1));
    for (let i = 0; i < newShape.length; i++) { newShape[i] = (x.shape[i] || 1) + (y.shape[i] || 1); }
    return new JArray(newShape, [...x.data, ...y.data], x.unit);
}, Infinity, Infinity).register();

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

function reduce(stack, lookupFn, exportFn) {
    if (stack.length <= 1) {
        return false;
    }
    /*
        | leftmost stack word	|      other stack words      | action  |
        | § =. =: (             | V     | N       | anything  | 0 Monad |
        | § =. =: ( A V N       | V     | V       | N         | 1 Monad |
        | § =. =: ( A V N       | N     | V       | N         | 2 Dyad  |
        | name N                | =. =:	| C A V N | anything  | 8 Is    |
    */
    if ([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 && classify(stack[1]) === 'V' && classify(stack[2]) === 'N' &&
        monads[stack[1]]) {
        // 0 Monad
        const [_, s2] = evaluateToken(stack[2], lookupFn);
        stack.splice(1, 2, monads[stack[1]].apply(s2));
        return true;
    } else if (([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 || ['A', 'V', 'N'].indexOf(classify(stack[0])) !== -1) &&
        classify(stack[1]) === 'V' && classify(stack[2]) === 'V' && classify(stack[3]) === 'N' &&
        monads[stack[2]]) {
        // 1 Monad
        const [_, s3] = evaluateToken(stack[3], lookupFn);
        stack.splice(2, 2, monads[stack[2]].apply(s3));
        return true;
    } else if (([BEGIN, '=.', '=:', '('].indexOf(stack[0]) !== -1 || ['A', 'V', 'N'].indexOf(classify(stack[0])) !== -1) &&
        classify(stack[1]) === 'N' && classify(stack[2]) === 'V' && classify(stack[3]) === 'N' &&
        dyads[stack[2]]) {
        // 2 Dyad
        const [_1, s1] = evaluateToken(stack[1], lookupFn);
        const [_2, s3] = evaluateToken(stack[3], lookupFn);
        stack.splice(1, 3, dyads[stack[2]].apply(s1, s3));
        return true;
    } else if (stack[0].length > 0 && ['=.', '=:'].indexOf(stack[1]) !== -1 && ['C', 'A', 'V', 'N'].indexOf(classify(stack[2])) !== -1) {
        // 8 Is
        const [_, s2] = evaluateToken(stack[2], lookupFn);
        exportFn(stack[0], s2)
        stack.splice(0, 3);
        return true;
    } else if (stack[0] === BEGIN && classify(stack[1] === 'N')) {
        // -1 I guess this isn't parsing or reduction per se, but when are we
        // supposed to translate '123' into an atom with value 123?
        const [reducedp, s1] = evaluateToken(stack[1], lookupFn);
        stack.splice(1, 2, s1);
        return reducedp;
    }

    return false;
}

// Returns a tuple containing:
// - Whether any evaluation was necessary.
// - The evaluated token.
function evaluateToken(token, lookupFn) {
    let lookup;
    if (token instanceof JArray) {
        return [false, token];
    } else if (token === BEGIN) {
        return [false, token];
    } else if (!isNaN(parseInt(token, 10))) {
        return [true, new JArray([], [parseInt(token, 10)])];
    } else if (verbs[token] !== undefined) {
        return [false, token];
    } else if (['=:'].indexOf(token) !== -1) {
        return [false, token];
    } else if ((lookup = lookupFn(token)) !== null) {
        return [true, lookup instanceof JArray ? lookup : new JArray([], [lookup])];
    } else {
        throw new Error(`Unknown symbol: ${token}`);
    }
}

function runJFragment(code, lookupFn, exportFn) {
    let debugInfo = [];

    const tokens = tokenize(code);
    debugInfo.push("Tokens", JSON.stringify(tokens));

    // Parsing and execution proceed simultaneously, one token at a time.
    // https://code.jsoftware.com/wiki/Vocabulary/Parsing
    const stack = [];
    while (tokens.length > 0) {
        const tail = tokens.pop();
        stack.splice(0, 0, tail);
        while (reduce(stack, lookupFn, exportFn)) {
            debugInfo.push('Stack', JSON.stringify(stack));
        }
    }

    debugInfo.push('Finished stack', JSON.stringify(stack));
    console.log(debugInfo.join(' > '));

    return stack[1];
};

if (typeof module !== 'undefined') {
    module.exports = { runJFragment, JArray };
}
