const fs = require('fs');
const path = require('path');

function deleteOldDirs(dirPath) {
  fs.readdir(dirPath, (err, dirNames) => {
    if (err) throw err;

    const now = Date.now();

    for(let name of dirNames){
      const folderDate = new Date(name.split('-').slice(0, 3).join('-')).getTime();
      const days = 30 * 24 * 60 * 60 * 1000; // One month

      // If the folder is older than one week, delete it
      if(now - folderDate > days){
        fs.rm(path.join(dirPath, name), { recursive: true }, (err) => {
          if (err) {
            console.error(`Error while deleting ${name}: ${err}`);
          } else {
            console.log(`${name} is deleted!`);
          }
        });
      }
    }
  });
}


deleteOldDirs("../azure-screenshots");
