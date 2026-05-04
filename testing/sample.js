const https = require('https');
const fs = require('fs');

const baseUrl = "https://tonejs.github.io/audio/salamander/";

// The exact list of files from your piano_core.js file
const files = [
    "A0.mp3", "C1.mp3", "Ds1.mp3", "Fs1.mp3", "A1.mp3",
    "C2.mp3", "Ds2.mp3", "Fs2.mp3", "A2.mp3", "C3.mp3",
    "Ds3.mp3", "Fs3.mp3", "A3.mp3", "C4.mp3", "Ds4.mp3",
    "Fs4.mp3", "A4.mp3", "C5.mp3", "Ds5.mp3", "Fs5.mp3",
    "A5.mp3", "C6.mp3", "Ds6.mp3", "Fs6.mp3", "A6.mp3",
    "C7.mp3", "Ds7.mp3", "Fs7.mp3", "A7.mp3", "C8.mp3"
];

console.log("Starting downloads...");

files.forEach(file => {
    https.get(baseUrl + file, (res) => {
        // Create a new file on your hard drive
        const fileStream = fs.createWriteStream(file);
        
        // Pour the downloaded data into the file
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Successfully downloaded: ${file}`);
        });
    }).on('error', (err) => {
        console.error(`Error downloading ${file}:`, err.message);
    });
});