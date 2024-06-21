import repl from 'repl';

declare class REPLProvider<C> {
    context: C;
    repl: repl.REPLServer;
    constructor(context: C);
    private customEval;
}

export = REPLProvider;
