export function logWarn(msg: string): string {
    if (process.env.NODE_ENV === "production") {
    } else {
        console.warn(msg);
    }
    return msg;
}

export function log(msg: string): string {
    if (process.env.NODE_ENV === "production") {
    } else {
        console.log(msg);
    }
    return msg;
}

export function logDoc(html: string): string {
    const p = document.createElement("p");
    p.innerHTML = html;
    document.body.prepend(p);
    return html;
}