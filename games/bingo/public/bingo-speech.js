// Articulación visual en español. No sintetiza ni reproduce audio.
const units=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const tens=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
export function bingoNumberText(number){
  if(!Number.isInteger(number)||number<1||number>90)throw new RangeError('Número de bingo inválido.');
  return number<30?units[number]:tens[Math.floor(number/10)]+(number%10?' y '+units[number%10]:'');
}
export function createVisemes(text){
  const letters=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const shapes={a:[1,.95],e:[1,.72],i:[1.1,.32],o:[.68,.9],u:[.6,.65],m:[1,.06],b:[1,.06],p:[1,.06],f:[1,.18],v:[1,.18],' ':[1,.13]};
  const frames=[{width:1,open:.15,weight:1.2},...[...letters].map(letter=>{const [width,open]=shapes[letter]||[.98,.32];return {width,open,weight:/[aeiou]/.test(letter)?1.3:.65};}),{width:1,open:.5,weight:1.4}];
  const total=frames.reduce((sum,frame)=>sum+frame.weight,0);let cursor=0;
  return frames.map(frame=>{const start=cursor/total;cursor+=frame.weight;return {...frame,start,end:cursor/total};});
}
export function sampleViseme(frames,progress){
  const p=Math.max(0,Math.min(1,progress)),index=Math.max(0,frames.findIndex(frame=>p<=frame.end));
  const next=frames[index],previous=frames[Math.max(0,index-1)];let f=Math.min(1,(p-next.start)/(next.end-next.start)*2);f=f*f*(3-2*f);
  return {width:previous.width+(next.width-previous.width)*f,open:previous.open+(next.open-previous.open)*f};
}
