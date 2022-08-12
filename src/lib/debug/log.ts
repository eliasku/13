export function logWarn(...args: any[]) {
    if (process.env.NODE_ENV === "production") {
    } else {
        console.warn(...args);
    }
}

export function log(...args: any[]) {
    if (process.env.NODE_ENV === "production") {
    } else {
        console.log(...args);
    }
}

export function logDoc(html: string) {
    const p = document.createElement("p");
    p.innerHTML = html;
    document.body.prepend(p);
}