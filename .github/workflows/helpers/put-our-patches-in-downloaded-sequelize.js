// Copyright 2020 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

const jetpack = require('fs-jetpack');

// This function wraps our source code, patching our `require` calls, to make them point to the correct relative path.
function copyFileWrapping(sourcePath, destinationPath) {
  const contents = jetpack.read(sourcePath);
  jetpack.write(
    destinationPath,
    `
      'use strict';
      const originalRequire = require;
      require = modulePath => originalRequire(modulePath.replace(/^sequelize\\b/, '..'));
      console.log('[INFO] Applying "sequelize-cockroachdb" patches! (${JSON.stringify(destinationPath)})');
      (() => {
      // ------------------------------------------------------------------------------------
      ${contents}
      // ------------------------------------------------------------------------------------
      })();
    `
  );
}

// Wrap our source code files and write the wrapped versions into `.downloaded-sequelize/.cockroachdb-patches/`
for (const filename of jetpack.list('source')) {
  copyFileWrapping(`source/${filename}`, `.downloaded-sequelize/.cockroachdb-patches/${filename}`);
}
