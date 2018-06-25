// Type definitions for vorpal 1.12.0
// Project: https://github.com/dthree/vorpal
// Definitions by: Jim Buck <http://github.com/jimmyboh>, Amir Arad <greenshade@gmail.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="inquirer" />
/// <reference types="minimist" />

declare module "vorpal-log" {

    import Vorpal = require("vorpal");

    function VorpalLogAugmenter(vorpal: Vorpal, options?: any) : void

    export = VorpalLogAugmenter;
}