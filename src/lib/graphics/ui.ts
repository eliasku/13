import {drawText, fnt} from "./font";

let y = 15;
export const resetPrinter = () =>{
    y = 15;
}
export const termPrint = (text: string) => {
    drawText(fnt[0], text, 7, 2, y, 7, 1);
    y += 8;
}
