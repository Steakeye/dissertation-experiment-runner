import Vorpal from "vorpal";
import every from "lodash/every";
import isNum from "lodash/isNumber";
import getUniq from "lodash/uniq";
import fsExtra from "fs-extra";
import expandTilde from "expand-tilde";
import path from "path";
import {API} from "../definitions/exp-run";
import {ExpEvents} from "./exp-events";
import {vorpal_appdata} from "./plugins/vorpal-appdata";
import {exp_run as server} from "./server-api";
import {exp_run as user} from "./user-api";
import {keys} from "node-persist";

export module exp_run {

    import VorpalWithAppdata = vorpal_appdata.VorpalWithAppdata;


    export interface RangeTuple {
        0: number[],
        1:boolean
    }

    const EVT_VORPAL_KEYPRESS: string = 'keypress';
    const EVT_VORPAL_KEYPRESS_ESC_KEY: string = 'escape';

    type VorpalCommandWithFn = Vorpal.Command & ({ _fn: () => void } | { _fn: (args: any, opts?: any) => void });

    export class MetaApi implements API {

        constructor(private vorpalInstance: Vorpal) {
            this.configureEventListeners();
            this.revivePreviousRange();
            this.revivePreviousSaveDir();
            this.revivePreviousExperimentIndex();
            this.setupExpRunner();
            this.setupDetailsGetter();
            this.setupRangeGetter();
            this.setupRangeSetter();
            this.setupDirGetter();
            this.setupDirSetter();
        }

        public get range(): number[] { return this.expRange; }
        public get directory(): string { return this.saveDir; }

        private setupDetailsGetter() {
            const rangeGetter = (): RangeTuple => {
                return [this.expRange, this.rangeFixedFirstPos];
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_GET_DETAILS, MetaApi.COMMAND_DESC_GET_DETAILS)
                .action(function(args, callback) {
                    const noOp = () => {};
                    const funcArgs: any[] = [undefined, noOp];

                    this.log(MetaApi.ACTION_DESC_GET_DETAILS);

                    let func: VorpalCommandWithFn = <VorpalCommandWithFn>this.parent.find(MetaApi.COMMAND_NAME_GET_SAVE_DIR);
                    func._fn.apply(this, funcArgs);

                    func = <VorpalCommandWithFn>this.parent.find(server.ServerApi.COMMAND_NAME_GET_SERVER);
                    func._fn.apply(this, funcArgs);

                    func = <VorpalCommandWithFn>this.parent.find(server.ServerApi.COMMAND_NAME_GET_SERVER_REDIRECT);
                    func._fn.apply(this, funcArgs);

                    func = <VorpalCommandWithFn>this.parent.find(MetaApi.COMMAND_NAME_GET_RANGE);
                    func._fn.apply(this, funcArgs);

                    func = <VorpalCommandWithFn>this.parent.find(user.UserApi.COMMAND_NAME_GET_USER);
                    func._fn.apply(this, funcArgs);

                    func = <VorpalCommandWithFn>this.parent.find(user.UserApi.COMMAND_NAME_GET_USER_ORDER);
                    func._fn.apply(this, funcArgs);

                    callback();
                });
        }

        private setupRangeGetter() {
            const rangeGetter = (): RangeTuple => {
                return [this.expRange, this.rangeFixedFirstPos];
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_GET_RANGE, MetaApi.COMMAND_DESC_GET_RANGE)
                .action(function(args, callback) {
                    const rangeTuple: RangeTuple = rangeGetter();
                    const range: number[] = rangeTuple[0];
                    const hasEmailAddress: boolean = !!range.length;
                    const keepFirstPos: boolean = rangeTuple[1];
                    const message: string = hasEmailAddress ? `${MetaApi.ACTION_DESC_GET_RANGE}${range} - ${MetaApi.ACTION_DESC_RANGE_KEEP_FIRST}${keepFirstPos}` :
                        MetaApi.ACTION_DESC_GET_RANGE_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupRangeSetter() {
            const rangeSetter = (range: number[], keepFirstPos: boolean = false) => {
                const rangeNums: number[] = this.expRange;

                rangeNums.length = 0;

                rangeNums.push(...range);

                this.rangeFixedFirstPos = keepFirstPos;
            };
            const rangeNumbersWrapper = () => {
                this.cacheRangeNumbers();
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_SET_RANGE, MetaApi.COMMAND_DESC_SET_RANGE)
                .option(MetaApi.OPTION_FLAG_SET_RANGE_KEEP_FIRST_POS, MetaApi.OPTION_DESC_SET_RANGE_KEEP_FIRST_POS)
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
                    const keepFirstPos: boolean = !!args.options["keep-first"];
                    const message: string = range ? `${MetaApi.ACTION_DESC_SET_RANGE}${range} - ${MetaApi.ACTION_DESC_RANGE_KEEP_FIRST}${keepFirstPos}`:
                        MetaApi.ACTION_DESC_SET_RANGE_EMPTY;

                    this.log(message);

                    rangeSetter(range || [], keepFirstPos);

                    rangeNumbersWrapper();

                    this.parent.emit(ExpEvents.EVT_RANGE_SET);

                    callback();
                });
        }

        private setupDirGetter() {
            const dirGetter = () => {
                return this.saveDir;
            };

            this.vorpalInstance
                .command(MetaApi.COMMAND_NAME_GET_SAVE_DIR, MetaApi.COMMAND_DESC_GET_SAVE_DIR)
                .option(MetaApi.OPTION_FLAG_SAVE_DIR_USER, MetaApi.OPTION_DESC_SAVE_DIR_USER)
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
                this.cacheSaveDir();
            };
            const pathResolver = (args: Vorpal.Args) => {
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

        private setupExpRunner() {
            const meta : MetaApi = this;
            const vI : Vorpal = this.vorpalInstance;

            let serverUrl: string | null = null;
            let userOrder: number[] | null = null;

            vI.command(MetaApi.COMMAND_NAME_RUN_EXP, MetaApi.COMMAND_DESC_RUN_EXP)
                .validate(function (args) {
                    const messageArr: string[] = [];

                    vI.emit(ExpEvents.REQUEST_SERVER, (url: string) => {
                        serverUrl = url;
                    });
                    vI.emit(ExpEvents.REQUEST_USER_ORDER, (nums: number[]) => {
                        userOrder = nums;
                    });

                    if (!serverUrl || !userOrder) {
                        messageArr.push(MetaApi.VALID_FAIL_DESC_RUN_EXP);
                        !serverUrl && messageArr.push(MetaApi.VALID_FAIL_DESC_RUN_EXP_NO_SERVER);
                        !userOrder && messageArr.push(MetaApi.VALID_FAIL_DESC_RUN_EXP_NO_USER);
                    }

                    return messageArr.length ? messageArr.join(' ') : true;
                })
                .action(function(args, callback) {
                    this.log(MetaApi.ACTION_DESC_RUN_EXP);
                    this.log(`${MetaApi.ACTION_DESC_RUN_EXP_SERVER}${serverUrl}`);
                    this.log(`${MetaApi.ACTION_DESC_RUN_EXP_USER_ORDER}${userOrder}`);

                    meta.startPrompts(this, callback);

                    vI.on(EVT_VORPAL_KEYPRESS, meta.checkForExitInput);
                });
        }

        private startPrompts(vorpalCommand: Vorpal.CommandInstance, commandCb: () => void): any {
            const beginRunningExp: (commandCb: () => void) => void = this.setupOrderCycling(vorpalCommand);

            return this.startSavePrompt(vorpalCommand, commandCb, beginRunningExp);
        }

        private startSavePrompt(vorpalCommand: Vorpal.CommandInstance, commandCb: () => void, next: (commandCb: () => void) => void): any {
            return vorpalCommand.prompt({
                type: 'confirm',
                name: 'save',
                default: true,
                message: 'Save current user details??',
            }, (result: { save: boolean }) => {
                if (result.save) {
                    this.vorpalInstance.emit(ExpEvents.REQUEST_SAVE_USER);
                }

                next(commandCb);
            });
        }

        private setupOrderCycling(vorpalCommand: Vorpal.CommandInstance): (commandCb: () => void) => void {
            const vI: Vorpal = this.vorpalInstance;
            const userOptions: number[] = <number[]>this.fetchUserOrder();
            const orderOptions: string [] = userOptions.map((val:number, idx: number) => `${idx+1}: ${val}`);
            const noOp: () => void = () => {};
            const restartIdx: number = 0;

            orderOptions.push(MetaApi.OPTION_VAL_RUN_EXP_FINISH);

            let vcWFn: VorpalCommandWithFn;

            const orderIndexAccessor = (updatedVal?: number) : number | void => {
                if (updatedVal === undefined) {
                    return this.expIdx
                } else {
                    this.expIdx = updatedVal;
                }
            };
            const updateCachedIndex = () : void => {
                this.cacheExperimentIndex();
            };

            function selectExperiment(): (commandCb: () => void) => void {
                function promptInvoker(commandCb: () => void) {
                    vorpalCommand.prompt({
                        type: 'list',
                        name: MetaApi.OPTION_RESULT_KEY_RUN_EXP,
                        choices: orderOptions,
                        default: orderIndexAccessor(),
                        message: MetaApi.OPTION_TITLE_RUN_EXP,
                    }, (result: { setRedirectTo: string }) => {

                        const updatedOrderIdx: number = orderOptions.indexOf(result.setRedirectTo);
                        const updatedEndpoint: number = userOptions[updatedOrderIdx];

                        if (updatedEndpoint !== undefined) {
                            orderIndexAccessor(updatedOrderIdx);
                            updateCachedIndex();
                            (<(self: Vorpal, args: any, cb: () => void) => void >vcWFn._fn.call)(vI, { number: updatedEndpoint }, noOp);
                            promptInvoker(commandCb);
                            vI.ui.input("");
                        } else {
                            vI.log(MetaApi.OPTION_RESULT_KEY_RUN_EXP_END);
                            orderIndexAccessor(restartIdx);
                            updateCachedIndex();
                            commandCb();
                        }
                    });
                }

                return (commandCb: () => void) => {
                    if (!vcWFn) {
                        vcWFn = <VorpalCommandWithFn>vI.find(server.ServerApi.COMMAND_NAME_SET_SERVER_REDIRECT);
                    }

                    promptInvoker(commandCb);
                }
            }

            return selectExperiment();
        }

        private cacheRangeNumbers(): void {
            (<VorpalWithAppdata>this.vorpalInstance).appData.setItem(MetaApi.STORAGE_KEY_RANGE, [this.expRange, this.rangeFixedFirstPos]);
        }

        private revivePreviousRange(): void {
            const getRangeCB = (val: RangeTuple) => {
                if (val) {
                    this.expRange.push(...val[0]);
                    this.rangeFixedFirstPos = val[1];
                }
            };

           (<VorpalWithAppdata>this.vorpalInstance).appData.getItem(MetaApi.STORAGE_KEY_RANGE).then(getRangeCB);
        }

        private cacheSaveDir(): void {
            (<VorpalWithAppdata>this.vorpalInstance).appData.setItem(MetaApi.STORAGE_KEY_SAVE_DIR, this.saveDir);
        }

        private revivePreviousSaveDir(): void {
            const saveDirCB = (val: string | undefined) => {
                this.saveDir =  <string>val || "";
            };

            (<VorpalWithAppdata>this.vorpalInstance).appData.getItem(MetaApi.STORAGE_KEY_SAVE_DIR).then(saveDirCB);
        }

        private cacheExperimentIndex(): void {
            (<VorpalWithAppdata>this.vorpalInstance).appData.setItem(MetaApi.STORAGE_KEY_EXP_INDEX, this.expIdx);
        }

        private revivePreviousExperimentIndex(): void {
            const saveDirCB = (val: number | undefined) => {
                this.expIdx =  <number>val || 0;
            };

            (<VorpalWithAppdata>this.vorpalInstance).appData.getItem(MetaApi.STORAGE_KEY_EXP_INDEX).then(saveDirCB);
        }

        private configureEventListeners(): void {
            const vI = this.vorpalInstance;
            this.publishDirValue = this.publishDirValue.bind(this);
            this.publishRangeValue = this.publishRangeValue.bind(this);
            //this.checkForExitInput = this.checkForExitInput.bind(this);

            vI.on(ExpEvents.REQUEST_DIR, this.publishDirValue);
            vI.on(ExpEvents.REQUEST_RANGE, this.publishRangeValue);
        }

        private publishDirValue(cb: (dir: string) => void): void {
            cb(this.saveDir);
        }

        private publishRangeValue(cb: (range: number[], fixedFirstPosition: boolean) => void): void {
            cb(this.expRange, this.rangeFixedFirstPos);
        }

        private checkForExitInput(evt : { key: string, value: string, e: Event }): void {
            this.vorpalInstance.log('checkForExitInput: ' + evt.key);

            if (evt.key === EVT_VORPAL_KEYPRESS_ESC_KEY) {
                this.vorpalInstance.log('Esc was pressed, exiting experiments early...');
                this.vorpalInstance.log(evt);
                //this.vorpalInstance.off(EVT_VORPAL_KEYPRESS, this.checkForExitInput);
                this.vorpalInstance.ui.cancel();
            }
        }


        private fetchUserOrder(): number[] | null {
            let userOrder: number[] | null = null;

            this.vorpalInstance.emit(ExpEvents.REQUEST_USER_ORDER, (nums: number[]) => {
                userOrder = nums;
            });

            return userOrder;
        }

        private static readonly STORAGE_KEY_RANGE: string = "range";
        private static readonly STORAGE_KEY_EXP_INDEX: string = "exp-index";
        private static readonly STORAGE_KEY_SAVE_DIR: string = "save-dir";

        private static readonly COMMAND_NAME_GET_DETAILS: string = "get-details";

        private static readonly COMMAND_DESC_GET_DETAILS: string = "Gets the all the details set up in the experiment runner";
        private static readonly ACTION_DESC_GET_DETAILS: string = "Details are as follows...";
        private static readonly COMMAND_NAME_GET_RANGE: string = "get-range";
        private static readonly COMMAND_DESC_GET_RANGE: string = "Gets the experiment range";

        private static readonly ACTION_DESC_GET_RANGE: string = "Experiment range set to: ";
        private static readonly ACTION_DESC_GET_RANGE_NOT_SET: string = "Experiment range not set!";
        private static readonly COMMAND_NAME_SET_RANGE: string = "set-range [numbers...]";
        private static readonly COMMAND_DESC_SET_RANGE: string = "Sets the experiment range. Passing no values unsets the range.";
        private static readonly OPTION_FLAG_SET_RANGE_KEEP_FIRST_POS: string = "--keep-first, -k";
        private static readonly OPTION_DESC_SET_RANGE_KEEP_FIRST_POS: string = "Determines whether the range is expected to always have the first value fixed";
        private static readonly VALID_FAIL_DESC_SET_RANGE: string = "Cannot set the experiment range as values must be unique numbers";
        private static readonly ACTION_DESC_SET_RANGE: string = "Setting experiment range to: ";

        private static readonly ACTION_DESC_SET_RANGE_EMPTY: string = "Unsetting experiment range";

        private static readonly ACTION_DESC_RANGE_KEEP_FIRST: string = "First item position preserved: ";
        private static readonly COMMAND_NAME_GET_SAVE_DIR: string = "get-save-dir";
        private static readonly COMMAND_DESC_GET_SAVE_DIR: string = "Gets the experiment save directory";
        private static readonly ACTION_DESC_GET_SAVE_DIR: string = "Experiment save directory set to: ";

        private static readonly ACTION_DESC_GET_SAVE_DIR_NOT_SET: string = "Experiment save directory not set!";
        private static readonly COMMAND_NAME_SET_SAVE_DIR: string = "set-save-dir [directory]";
        private static readonly COMMAND_DESC_SET_SAVE_DIR: string = "Sets the experiment save directory, resolving it where necessary. Passing no values unsets the save directory.";
        private static readonly VALID_FAIL_DESC_SET_SAVE_DIR: string = "Cannot set the save directory to non-existant folder";
        private static readonly ACTION_DESC_SET_SAVE_DIR: string = "Setting experiment save directory to: ";
        private static readonly ACTION_DESC_SET_SAVE_DIR_EMPTY: string = "Unsetting experiment save directory";

        private static readonly OPTION_FLAG_SAVE_DIR_USER: string = "--user-data, -u";
        private static readonly OPTION_DESC_SAVE_DIR_USER: string = "Specifies the save-directory to be used for user data.";

        private static readonly COMMAND_NAME_RUN_EXP: string = "run-experiments";
        private static readonly COMMAND_DESC_RUN_EXP: string = "Starts running the configuring the redirect url on the server based on the user experiment order";
        private static readonly VALID_FAIL_DESC_RUN_EXP: string = "Cannot start running experiments.";
        private static readonly VALID_FAIL_DESC_RUN_EXP_NO_SERVER: string = "No server url set.";
        private static readonly VALID_FAIL_DESC_RUN_EXP_NO_USER: string = "No user set.";
        private static readonly ACTION_DESC_RUN_EXP: string = "Starting experiments...";
        private static readonly ACTION_DESC_RUN_EXP_SERVER: string = "Server: ";
        private static readonly ACTION_DESC_RUN_EXP_USER_ORDER: string = "User order: ";
        private static readonly OPTION_TITLE_RUN_EXP: string = "Set redirect to:";
        private static readonly OPTION_VAL_RUN_EXP_FINISH: string = "Complete experiments!";
        private static readonly OPTION_RESULT_KEY_RUN_EXP: string = "setRedirectTo";
        private static readonly OPTION_RESULT_KEY_RUN_EXP_END: string = "Exiting experiment running mode...";

        private expIdx: number = 0;
        private expRange: number[] = [];
        private rangeFixedFirstPos: boolean = false;
        private saveDir: string = "";
    }
}