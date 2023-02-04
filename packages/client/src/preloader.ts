const preloader = document.createElement("div");
preloader.style.color = "white";
preloader.style.width = "100%";
preloader.style.height = "100%";
preloader.style.position = "absolute";
preloader.style.left = "0";
preloader.style.top = "0";
preloader.style.zIndex = "99999";
preloader.style.fontFamily = "monospace";
preloader.style.background = "#000";
preloader.innerHTML = `
<div style="position: fixed;top: 50%;left: 50%;
transform: translate(-50%, -50%); text-align: center">
<h1 style="color:red">iioi</h1>
<h2 style="color:lightcyan">loading...</h2>
<h3 id="preloader-progress">[ ................ ]</h3>
</div>`;

document.body.appendChild(preloader);

export function setLoadingProgress(v: number) {
    const el = document.getElementById("preloader-progress");
    const segments = 16;
    if (el) {
        const p = (v * segments) | 0;
        const l = segments - p;
        el.innerText = `[ ${"x".repeat(p)}${".".repeat(l)} ]`;
    }
}

export function completeLoading() {
    preloader.style.opacity = "0";
    preloader.style.transition = "all 0.2s 0.1s ease-out";
    setTimeout(() => {
        preloader.remove();
    }, 300);
}