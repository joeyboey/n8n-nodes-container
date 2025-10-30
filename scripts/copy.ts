import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";
import { glob } from "glob";

const files = glob.sync("src/{credentials,nodes}/**/*.{png,svg,json}");
files.forEach((file) => {
    const destination = file.replace("src/", "dist/");
    const destDir = path.dirname(destination);
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`${chalk.green("✔")} ${file} -> ${destination}`);
    fs.copyFileSync(file, destination);
});
