#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const util = require('util');
const wall = require('./wall');
const { Writable } = require('stream');
const { walk, arrayLoop } = require('./helpers');

function cipher(action, file, verbose = false) {
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let i = false;

  rl.query = 'Password: ';

  rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (i) {
      rl.output.write(`\x1B[2K\x1B[200D${rl.query}`);
    } else {
      rl.output.write(stringToWrite);
    }

    i = true;
  };

  process.stdout.write(rl.query)
  rl.question(rl.query, async key => {
    i = false;
    rl.query = 'Confirm password: ';

    process.stdout.write(`\n${rl.query}`);
    rl.question(rl.query, async key2 => {
      try {
        process.stdout.write('\n');

        if (key !== key2) {
          console.log('\nPasswords does not match.');
          return process.exit();
        }

        rl.close();

        const stat = await util.promisify(fs.stat)(file);

        const files = stat.isDirectory() ? await walk(file) : [file];

        const loop = arrayLoop(files, file => {
          return wall.cipherizeFile(file, key, action === 'encrypt')
            .then(() => console.log(`\x1b[32mDone ${action}ing\x1b[0m - ${file}`))
            .catch(() => console.log(`\x1b[31mFAILED ${action}ing\x1b[0m - ${file}`));
        });

        const repeat = () => {
          const wait = loop.next();

          if (wait.value) {
            wait.value.then(repeat);
          }
        }

        for (let i = 0; i < 5; i++) {
          repeat();
        }
      } catch (e) {
        console.error(e.message);
      }
    });
  });
}

program
  .version('2.1.1', '-V, --version')
  .usage('[options] <mode> <dir> <key>')
  .option('-v, --verbose', 'enable verbosity');

program
  .command('encrypt <file>')
  .description('encrypt a file or all files in a directory')
  .action((file, key, options) => cipher('encrypt', file, key, options && options.verbose));

program
  .command('decrypt <file> [options]')
  .description('decrypt a file or all files in a directory')
  .action((file, key, options) => cipher('decrypt', file, key, options && options.verbose));

program.parse(process.argv);