import EventEmitter from 'events';
import Vorpal from "vorpal";
import range from "lodash/range";
import fsExtra from "fs-extra";
import Chance from "chance";
import {isEmail} from "validator";
import {API} from "../definitions/exp-run";
import {ExpEvents} from "./exp-events";

export module exp_run {

    export class UserApi implements API {

        constructor(private vorpalInstance: Vorpal) {
            this.revivePreviousUser();
            this.setupUserGetter();
            this.setupUserSetter();
            this.setupUserNumbersGetter();
            this.setupSaveUserDetails();
        }

        public get emailAddress(): string { return this.userEmail; }

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
                    const message: string = hasUserNums ? `${UserApi.ACTION_DESC_GET_USER_ORDER}${userNums}` : UserApi.ACTION_DESC_GET_USER_ORDER_NOT_SET;

                    this.log(message);

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

            const pb: EventEmitter = this.vorpalInstance;

            let sentDir: string | null = null;

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_SAVE_CURRENT_USER, UserApi.COMMAND_DESC_SAVE_CURRENT_USER)
                .validate(function(args) {
                    pb.emit(ExpEvents.REQUEST_DIR, (dir: string) => {
                        sentDir = dir;
                    });

                    const email: string = userEmailGetter();
                    const userNums: number[] = userNumGetter();
                    const hasEmail: boolean = !!email.length;
                    const hasUserNums: boolean = !!userNums.length;

                    let result: string | true;

                    if (!sentDir) {
                        result = UserApi.VALID_FAIL_DESC_SAVE_CURRENT_USER_DIR;
                    } else if (hasEmail && hasUserNums) {
                        result = true;
                    } else {
                        result = UserApi.VALID_FAIL_DESC_SAVE_CURRENT_USER_EMPTY;
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    const filePath: string = `${sentDir}/${userEmailGetter()}.json`;
                    const message: string = `${UserApi.ACTION_DESC_SAVE_CURRENT_USER}${filePath}`;

                    this.log(message);

                    fsExtra.writeJSONSync(filePath, { email: userEmailGetter(), "exp_order": userNumGetter() })

                    callback();
                });
        }

        private updateUserNumbers(emailAddress: string): void {
            const userNums: number[] = this.userNumbers;

            userNums.length = 0;

            if (emailAddress) {
                //const orderOptions: number[] = range(2, 9);
                const orderOptions: number[] | null = this.fetchExperimentRange();

                if (orderOptions) {
                    const randomOrderGen: Chance.Chance = Chance.Chance(emailAddress);
                    userNums.push(1, ...randomOrderGen.pickset(orderOptions, orderOptions.length));
                } else {
                    this.vorpalInstance.log(UserApi.ACTION_DESC_SET_USER_NUMBERS_FAIL)
                }
            }
        }

        private cacheCurrentUser(): void {
            this.vorpalInstance.localStorage.setItem(UserApi.STORAGE_KEY_CURRENT_USER, this.userEmail);
        }

        private revivePreviousUser(): void {
            const user: string | null = this.vorpalInstance.localStorage.getItem(UserApi.STORAGE_KEY_CURRENT_USER);

            this.userEmail = user || "";

            if (user) {
                this.updateUserNumbers(user)
            }
        }

        private fetchExperimentRange(): number[] | null {
            let expRange: number[] | null = null;

            this.vorpalInstance.emit(ExpEvents.REQUEST_RANGE, (range: number[]) => {
                expRange = range;
            });

            return expRange;
        }

        private static readonly STORAGE_KEY_CURRENT_USER: string = "current-user";

        private static readonly COMMAND_NAME_GET_USER: string = "get-user";
        private static readonly COMMAND_DESC_GET_USER: string = "Gets the current user email";
        private static readonly ACTION_DESC_GET_USER: string = "User email address set to: ";
        private static readonly ACTION_DESC_GET_USER_NOT_SET: string = "User email address not set!";

        private static readonly COMMAND_NAME_SET_USER: string = "set-user [email]";
        private static readonly COMMAND_DESC_SET_USER: string = "Sets the user email address. Passing no value unsets the user email address.";
        private static readonly VALID_FAIL_DESC_SET_USER: string = "Cannot set user email address to invalid user email address";
        private static readonly ACTION_DESC_SET_USER: string = "Setting user email address to: ";
        private static readonly ACTION_DESC_SET_USER_EMPTY: string = "Unsetting user email address";
        private static readonly ACTION_DESC_SET_USER_NUMBERS_FAIL: string = "Could not generate user experment order because experiment range has not been set";

        private static readonly COMMAND_NAME_GET_USER_ORDER: string = "get-user-order";
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
        //private randomNumGen: Chance.Chance = Chance.Chance();
    }
}