// http://stackoverflow.com/a/16001019
function numberToFloat(bytes) {
    const sign = (bytes & 0x80000000) ? -1 : 1;
    let exponent = ((bytes >> 23) & 0xFF) - 127;
    let significand = (bytes & ~(-1 << 23));

    if (exponent === 128)
        return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);

    if (exponent === -127) {
        if (significand === 0) {
            return sign * 0.0;
        }
        exponent = -126;
        significand /= (1 << 22);
    } else significand = (significand | (1 << 23)) / (1 << 23);

    return sign * significand * Math.pow(2, exponent);
}


const b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58_decode(S,A){var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)}
function convert(ps) {
    const data = b58_decode(ps, b58alphabet);
    const wave = data[0];
    const params = new Float32Array(23);
    params[0] = wave;
    let pi = 1;
    for(let i = 1; i < data.length; i += 4) {
        const val = (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24));
        params[pi++] = numberToFloat(val);
    }
    return params;
}

const r = convert("57uBnWa56Fo9ibwaQPYtyeVJTzXLcMoBS8j2Fm4KTP5b5cHCrSwehjR4btA6sJLJ3JFyshkJbihSMvrs6kMvNqixdVL1VqALja7TAfHvXYGYy8A3TamjGgNdV");
const arr = [...r.values()];
function f2a(f) {
    const a = f.toString();
    let b = f.toPrecision(6);
    while(b.length > 3 && b[b.length - 1] === "0") {
        b = b.substring(0, b.length - 1);
    }
    return a.length < b.length ? a : b;
}
console.info(`[${arr.map(x=>f2a(x)).join(",")}]`);
