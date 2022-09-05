
/* @__PURE__ */
const polyOut = (t:number):number => {
    const x = 1 - t;
    return 1 - x * x;
}

/* @__PURE__ */
const cubicOut = (t:number):number => {
    const x = 1 - t;
    return 1 - x * x * x;
}
