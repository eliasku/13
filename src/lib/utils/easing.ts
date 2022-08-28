
/* @__PURE__ */
function polyOut(t:number):number {
    const x = 1 - t;
    return 1 - x * x;
}

/* @__PURE__ */
function cubicOut(t:number):number {
    const x = 1 - t;
    return 1 - x * x * x;
}
