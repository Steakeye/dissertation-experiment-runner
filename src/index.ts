/// <reference path="../definitions/vorpal/vorpal.d.ts" />

import Vorpal from 'vorpal';
//import VorpalType from 'vorpal-typeScript-typings';
//import * as Vorpal from 'vorpal-typeScript-typings';

const vorpal = new Vorpal();

vorpal
    .command('foo', 'Outputs "bar".')
    .action(function(args, callback) {
        this.log('bar');
        callback();
    });

vorpal
    .delimiter('myapp$')
    .show();