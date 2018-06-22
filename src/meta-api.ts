import EventEmitter from 'events';
import Vorpal from "vorpal";
import every from "lodash/every";
import isNum from "lodash/isNumber";
import getUniq from "lodash/uniq";
import fsExtra from "fs-extra";
import expandTilde from "expand-tilde";
import path from "path";
import {API} from "../definitions/exp-run";
import {ExpEvents} from "./exp-events";

export module exp_run {

    export class MetaApi implements API {

        constructor(private vorpalInstance: Vorpal, private pubSub: EventEmitter) {
            this.configureEventListeners();
            this.revivePreviousRange();
            this.revivePreviousSaveDir();
            this.setupRangeGetter();
            this.setupRangeSetter();
            this.setupDirGetter();
            this.setupDirSetter();
        }

        public get range(): number[] { return this.expRange; }
        public get directory(): string { return this.saveDir; }

        private setupRangeGetter() {
            const rangeGetter = () => {
                return this.expRange;
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_GET_RANGE, MetaApi.COMMAND_DESC_GET_RANGE)
                .action(function(args, callback) {
                    const range: number[] = rangeGetter();
                    const hasEmailAddress: boolean = !!range.length;
                    const message: string = hasEmailAddress ? `${MetaApi.ACTION_DESC_GET_RANGE}${range}` : MetaApi.ACTION_DESC_GET_RANGE_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupRangeSetter() {
            const rangeSetter = (range: number[]) => {
                const rangeNums: number[] = this.expRange;

                rangeNums.length = 0;

                rangeNums.push(...range);
            };
            const rangeNumbersWrapper = () => {
                this.updateRangeNumbers();
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_SET_RANGE, MetaApi.COMMAND_DESC_SET_RANGE)
                .validate(function (args) {
                    const nums: number[] | null = <number[]>args.numbers || null;

                    const isUniqueNumSet: (nums: number[]) => boolean = (nums: number[]) => {
                        return every(nums, isNum) && (getUniq(nums).length == nums.length);
                    };

                    let result: string | true;

                    if (nums === null || isUniqueNumSet(nums)) {
                        result = true;
                    } else {
                        result = MetaApi.VALID_FAIL_DESC_SET_RANGE;
                    }

                    return result;
                })
                .action(function(args, callback) {
                    const range: number[] = <number[]><any>args.numbers;
                    const message: string = range ? `${MetaApi.ACTION_DESC_SET_RANGE}${range}`: MetaApi.ACTION_DESC_SET_RANGE_EMPTY;

                    this.log(message);

                    rangeSetter(range || []);

                    rangeNumbersWrapper();

                    callback();
                });
        }

        private setupDirGetter() {
            const dirGetter = () => {
                return this.saveDir;
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_GET_SAVE_DIR, MetaApi.COMMAND_DESC_GET_SAVE_DIR)
                .action(function(args, callback) {
                    const dir: string = dirGetter();
                    const hasDir: boolean = !!dir.length;
                    const message: string = hasDir ? `${MetaApi.ACTION_DESC_GET_SAVE_DIR}${dir}` : MetaApi.ACTION_DESC_GET_SAVE_DIR_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupDirSetter() {
            const dirSetter = (dir: string) => {
                this.saveDir = dir;
            };
            const saveDirWrapper = () => {
                this.updateSaveDir();
            };
            const pathResolver = (args: Vorpal.Args) => {
                //return args.directory && path.resolve(__dirname, <string>args.directory);
                //return args.directory && expandTilde(<string>args.directory);
                return args.directory && path.resolve(__dirname, expandTilde(<string>args.directory));
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_SET_SAVE_DIR, MetaApi.COMMAND_DESC_SET_SAVE_DIR)
                .validate(function (args) {
                    const dir: string | null = pathResolver(args) || null;

                    const dirExists: (dir: string) => boolean = (dir: string) => {
                        return fsExtra.pathExistsSync(dir);
                    };

                    let result: string | true;

                    if (dir === null || dirExists(dir)) {
                        result = true;
                    } else {
                        result = MetaApi.VALID_FAIL_DESC_SET_SAVE_DIR;
                    }

                    return result;
                })
                .action(function(args, callback) {
                    const dir: string | null = pathResolver(args) || null;
                    const message: string = dir ? `${MetaApi.ACTION_DESC_SET_SAVE_DIR}${dir}`: MetaApi.ACTION_DESC_SET_SAVE_DIR_EMPTY;

                    this.log(message);

                    dirSetter(dir || "");

                    saveDirWrapper();

                    callback();
                });
        }

        private updateRangeNumbers(): void {
            this.vorpalInstance.localStorage.setItem(MetaApi.STORAGE_KEY_RANGE, JSON.stringify(this.expRange));
        }

        private revivePreviousRange(): void {
            const range: number[] | null = JSON.parse(this.vorpalInstance.localStorage.getItem(MetaApi.STORAGE_KEY_RANGE));

            if (range !== null) {
                this.expRange.push(...range);
            }

        }

        private updateSaveDir(): void {
            this.vorpalInstance.localStorage.setItem(MetaApi.STORAGE_KEY_SAVE_DIR, this.saveDir);
        }

        private revivePreviousSaveDir(): void {
            const dir: string | null = this.vorpalInstance.localStorage.getItem(MetaApi.STORAGE_KEY_SAVE_DIR);

            this.saveDir = dir !== null ? <string>dir : "";
        }

        private configureEventListeners(): void {
            this.publishDirValue = this.publishDirValue.bind(this);
            this.pubSub.on(ExpEvents.REQUEST_DIR, this.publishDirValue);
        }

        private publishDirValue(cb: (dir: string) => void): void {
            cb(this.saveDir);
        }

        private static readonly COMMAND_NAME_GET_RANGE: string = "get-range";
        private static readonly COMMAND_DESC_GET_RANGE: string = "Gets the experiment range";
        private static readonly ACTION_DESC_GET_RANGE: string = "Experiment range set to: ";
        private static readonly ACTION_DESC_GET_RANGE_NOT_SET: string = "Experiment range not set!";

        private static readonly COMMAND_NAME_SET_RANGE: string = "set-range [numbers...]";
        private static readonly COMMAND_DESC_SET_RANGE: string = "Sets the experiment range. Passing no values unsets the range.";
        private static readonly STORAGE_KEY_RANGE: string = "range";
        private static readonly VALID_FAIL_DESC_SET_RANGE: string = "Cannot set the experiment range as values must be unique numbers";
        private static readonly ACTION_DESC_SET_RANGE: string = "Setting experiment range to: ";
        private static readonly ACTION_DESC_SET_RANGE_EMPTY: string = "Unsetting experiment range";
        
        private static readonly COMMAND_NAME_GET_SAVE_DIR: string = "get-save-dir";
        private static readonly COMMAND_DESC_GET_SAVE_DIR: string = "Gets the experiment save directory";
        private static readonly ACTION_DESC_GET_SAVE_DIR: string = "Experiment save directory set to: ";
        private static readonly ACTION_DESC_GET_SAVE_DIR_NOT_SET: string = "Experiment save directory not set!";

        private static readonly COMMAND_NAME_SET_SAVE_DIR: string = "set-save-dir [directory]";
        private static readonly COMMAND_DESC_SET_SAVE_DIR: string = "Sets the experiment save directory, resolving it where necessary. Passing no values unsets the save directory.";
        private static readonly STORAGE_KEY_SAVE_DIR: string = "save-dir";
        private static readonly VALID_FAIL_DESC_SET_SAVE_DIR: string = "Cannot set the save directory to non-existant folder";
        private static readonly ACTION_DESC_SET_SAVE_DIR: string = "Setting experiment save directory to: ";
        private static readonly ACTION_DESC_SET_SAVE_DIR_EMPTY: string = "Unsetting experiment save directory";

        private expRange: number[] = [];
        private saveDir: string = "";
    }
}