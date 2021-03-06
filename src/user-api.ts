import EventEmitter from 'events';
import Vorpal, {CommandInstance} from "vorpal";
import fsExtra from "fs-extra";
import Chance from "chance";
import {isEmail} from "validator";
import {API} from "../definitions/exp-run";
import {ExpEvents} from "./exp-events";
import {exp_run as MetaApi} from "./meta-api";
import {vorpal_appdata} from "./plugins/vorpal-appdata";

export module exp_run {

    import VorpalWithAppdata = vorpal_appdata.VorpalWithAppdata;
    import RangeTuple = MetaApi.RangeTuple;

    export class UserApi implements API {

        public static readonly COMMAND_NAME_GET_USER: string = "get-user";
        public static readonly COMMAND_NAME_GET_USER_ORDER: string = "get-user-order";

        constructor(private vorpalInstance: Vorpal) {
            this.configureEventListeners();
            this.revivePreviousUser();
            this.setupUserGetter();
            this.setupUserSetter();
            this.setupUserNumbersGetter();
            this.setupSaveUserDetails();
        }

        public get emailAddress(): string { return this.userEmail; }

        private configureEventListeners(): void {
            const vI = this.vorpalInstance;
            this.updateUserNumbersOnRangeUpdate = this.updateUserNumbersOnRangeUpdate.bind(this);
            this.onRequestUser = this.onRequestUser.bind(this);
            this.onRequestUserOrder = this.onRequestUserOrder.bind(this);
            this.onRequestSaveUser = this.onRequestSaveUser.bind(this);

            vI.on(ExpEvents.EVT_RANGE_SET, this.updateUserNumbersOnRangeUpdate);
            vI.on(ExpEvents.REQUEST_USER, this.onRequestUser);
            vI.on(ExpEvents.REQUEST_USER_ORDER, this.onRequestUserOrder);
            vI.on(ExpEvents.REQUEST_SAVE_USER, this.onRequestSaveUser);
        }

        private setupUserGetter() {
            const userGetter = () => {
                return this.userEmail;
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_GET_USER, UserApi.COMMAND_DESC_GET_USER)
                .action(function(args, callback) {
                    const emailAddress: string = userGetter();
                    const hasEmailAddress: boolean = !!emailAddress.length;
                    const message: string = hasEmailAddress ? `${UserApi.ACTION_DESC_GET_USER}${emailAddress}` : UserApi.ACTION_DESC_GET_USER_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupUserSetter() {
            const userSetter = (emailAddress: string) => {
                this.userEmail = emailAddress;
                this.cacheCurrentUser();
            };
            const userNumbersWrapper = (emailAddress: string) => {
                this.updateUserNumbers(emailAddress);
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_SET_USER, UserApi.COMMAND_DESC_SET_USER)
                .validate(function (args) {
                    const email: string | null = <string>args.email || null;

                    let result: string | true;

                    if (email === null || isEmail(<string>email)) {
                        result = true;
                    } else {
                        result = UserApi.VALID_FAIL_DESC_SET_USER;
                    }

                    return result;
                })
                .action(function(args, callback) {
                    const emailAddress: string = <string>args.email;
                    const message: string = emailAddress ? `${UserApi.ACTION_DESC_SET_USER}${emailAddress}`: UserApi.ACTION_DESC_SET_USER_EMPTY;

                    this.log(message);

                    userSetter(emailAddress || '');

                    userNumbersWrapper(emailAddress);

                    callback();
                });
        }

        private setupUserNumbersGetter() {
            const userNumGetter = () => {
                return this.userNumbers;
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_GET_USER_ORDER, UserApi.COMMAND_DESC_GET_USER_ORDER)
                .action(function(args, callback) {
                    const userNums: number[] = userNumGetter();
                    const hasUserNums: boolean = !!userNums.length;

                    if (hasUserNums) {
                        this.log(`${UserApi.ACTION_DESC_GET_USER_ORDER}${userNums}`);
                    } else {
                        this.log(UserApi.ACTION_DESC_GET_USER_ORDER_NOT_SET);
                    }

                    callback();
                });
        }

        private setupSaveUserDetails() {
            const userEmailGetter = () => {
                return this.userEmail;
            };
            const userNumGetter = () => {
                return this.userNumbers;
            };

            const userApi: UserApi = this;

            let saveDir: string | null = null;

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_SAVE_CURRENT_USER, UserApi.COMMAND_DESC_SAVE_CURRENT_USER)
                .validate(function(args) {
                    saveDir = userApi.fetchSaveDir();

                    const email: string = userEmailGetter();
                    const userNums: number[] = userNumGetter();
                    const hasEmail: boolean = !!email.length;
                    const hasUserNums: boolean = !!userNums.length;

                    let result: string | true;

                    if (!saveDir) {
                        result = UserApi.VALID_FAIL_DESC_SAVE_CURRENT_USER_DIR;
                    } else if (hasEmail && hasUserNums) {
                        result = true;
                    } else {
                        result = UserApi.VALID_FAIL_DESC_SAVE_CURRENT_USER_EMPTY;
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    userApi.doSaveUser(<string>saveDir, userEmailGetter(), userNumGetter());

                    callback();
                });
        }

        private doSaveUser(saveDir: string, email: string, userOrder: number[]): void {
            const filePath: string = `${saveDir}/${email}.json`;
            const message: string = `${UserApi.ACTION_DESC_SAVE_CURRENT_USER}${filePath}`;

            this.vorpalInstance.log(message);

            fsExtra.writeJSONSync(filePath, { email: email, "exp_order": userOrder });
        }

        private updateUserNumbers(emailAddress: string, silent: boolean = false): void {
            const userNums: number[] = this.userNumbers;

            userNums.length = 0;

            if (emailAddress) {
                const orderOptions: RangeTuple | null = this.fetchExperimentRange();

                if (orderOptions) {
                    const nums = orderOptions[0];
                    const randomOrderGen: Chance.Chance = Chance.Chance(emailAddress);

                    if (orderOptions[1]) {
                        const firstVal: number = nums[0];
                        const nums2Onwards = nums.slice(1);
                        userNums.push(firstVal, ...randomOrderGen.pickset(nums2Onwards, nums2Onwards.length));
                    } else {
                        userNums.push(...randomOrderGen.pickset(nums, nums.length));
                    }
                    !silent && this.vorpalInstance.log(`${UserApi.ACTION_DESC_SET_USER_USER_ORDER}${userNums}`)
                } else {
                    !silent && this.vorpalInstance.log(UserApi.ACTION_DESC_SET_USER_NUMBERS_FAIL)
                }
            }
        }

        private updateUserNumbersOnRangeUpdate() : void {
            const email: string = this.userEmail;

            if (email) {
                this.updateUserNumbers(email);
            }
        }

        private onRequestUser(cb: (user: string | null) => void) : void {
            const userVal: string = this.userEmail;

            cb(userVal || null);
        }

        private onRequestUserOrder(cb: (nums: number[] | null) => void) : void {
            const nums: number[] = this.userNumbers;

            cb(nums.length ? nums : null);
        }

        private onRequestSaveUser() : void {
            this.doSaveUser(<string>this.fetchSaveDir(), this.userEmail, this.userNumbers);
        }

        private cacheCurrentUser(): void {
            (<VorpalWithAppdata>this.vorpalInstance).appData.setItem(UserApi.STORAGE_KEY_CURRENT_USER, this.userEmail);
        }

        private revivePreviousUser(): void {
            const getUserCB = (val: any) => {
                const user: string | null =  val;

                this.userEmail = user || "";

                if (user) {
                    this.updateUserNumbers(user, true)
                }
            };

            (<VorpalWithAppdata>this.vorpalInstance).appData.getItem(UserApi.STORAGE_KEY_CURRENT_USER).then(getUserCB);
        }

        private fetchSaveDir(): string | null {
            let saveDir: string | null = null;

            this.vorpalInstance.emit(ExpEvents.REQUEST_DIR, (dir: string) => {
                saveDir = dir;
            });

            return saveDir;
        }

        private fetchExperimentRange(): RangeTuple | null {
            let expRange: number[] | null = null;
            let keepFirst: boolean = false;
            let retVal: RangeTuple | null;

            this.vorpalInstance.emit(ExpEvents.REQUEST_RANGE, (range: number[], isFirstPosFixed: boolean) => {
                expRange = range;
                keepFirst = isFirstPosFixed;
            });

            if (expRange) {
                retVal =  [expRange, keepFirst];
            } else {
                retVal = null;
            }

            return retVal;
        }

        private static readonly STORAGE_KEY_CURRENT_USER: string = "current-user";

        private static readonly COMMAND_DESC_GET_USER: string = "Gets the current user email";
        private static readonly ACTION_DESC_GET_USER: string = "User email address set to: ";
        private static readonly ACTION_DESC_GET_USER_NOT_SET: string = "User email address not set!";

        private static readonly COMMAND_NAME_SET_USER: string = "set-user [email]";
        private static readonly COMMAND_DESC_SET_USER: string = "Sets the user email address. Passing no value unsets the user email address.";
        private static readonly VALID_FAIL_DESC_SET_USER: string = "Cannot set user email address to invalid user email address";
        private static readonly ACTION_DESC_SET_USER: string = "Setting user email address to: ";
        private static readonly ACTION_DESC_SET_USER_USER_ORDER: string = "Setting user experiment order to: ";
        private static readonly ACTION_DESC_SET_USER_EMPTY: string = "Unsetting user email address";
        private static readonly ACTION_DESC_SET_USER_NUMBERS_FAIL: string = "Could not generate user experiment order because experiment range has not been set";

        private static readonly COMMAND_DESC_GET_USER_ORDER: string = "Gets the user's experiment order";
        private static readonly ACTION_DESC_GET_USER_ORDER: string = "User's experiment order is: ";
        private static readonly ACTION_DESC_GET_USER_ORDER_NOT_SET: string = "User's experiment order not set (probably as there is no user email).";

        private static readonly COMMAND_NAME_SAVE_CURRENT_USER: string = "save-user-details";
        private static readonly COMMAND_DESC_SAVE_CURRENT_USER: string = "Saves the current user details to the experiment save directory.";
        private static readonly VALID_FAIL_DESC_SAVE_CURRENT_USER_DIR: string = "Cannot save user details to non-existant folder";
        private static readonly VALID_FAIL_DESC_SAVE_CURRENT_USER_EMPTY: string = "Cannot save non-existant user details";
        private static readonly ACTION_DESC_SAVE_CURRENT_USER: string = "Saving current user details to: ";

        private userEmail: string = "";
        private userNumbers: number[] = [];
    }
}