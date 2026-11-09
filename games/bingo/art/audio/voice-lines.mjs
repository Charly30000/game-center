// Piper --json-input: ejecutar en Docker y enviar stdout al sintetizador.
import { bingoNumberText } from '../../public/bingo-speech.js';
const bingo = {text:'¡Bingo! ¡Enhorabuena!',output_file:'/output/voice/bingo.wav'};
if (process.argv.includes('--bingo-only')) { console.log(JSON.stringify(bingo)); process.exit(0); }
for (let number=1;number<=90;number++) {
  console.log(JSON.stringify({text:`El número ${bingoNumberText(number)}.`,output_file:`/output/voice/number-${String(number).padStart(2,'0')}.wav`}));
}
console.log(JSON.stringify({text:'Marca tus números y pulsa continuar.',output_file:'/output/voice/continue.wav'}));
console.log(JSON.stringify(bingo));
