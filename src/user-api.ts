import Vorpal from "vorpal";
import range from "lodash/range";
import Chance from "chance";
import { create as RandomSeedCtor, RandomSeed } from "random-seed";
import {API} from "../definitions/exp-run";

export module exp_run {

    export class UserApi implements API {

        constructor(private vorpalInstance: Vorpal) {
            this.setupUserGetter();
            this.setupUserSetter();
            this.setupUserNumbersGetter();
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
            };
            const userNumbersWrapper = (emailAddress: string) => {
                this.updateUserNumbers(emailAddress);
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_SET_USER, UserApi.COMMAND_DESC_SET_USER)
                .action(function(args, callback) {
                    const emailAddress: string = <string>args.email;
                    const message: string = emailAddress ? `${UserApi.ACTION_DESC_SET_USER}${emailAddress}`: UserApi.ACTION_DESC_SET_USER_EMPTY

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

        private updateUserNumbers(emailAddress: string): void {
            const userNums: number[] = this.userNumbers;

            userNums.length = 0;

            if (emailAddress) {
                const orderOptions: number[] = range(2, 9);
                const randomOrderGen: Chance.Chance = Chance.Chance(emailAddress);

                userNums.push(1, ...randomOrderGen.pickset(orderOptions, orderOptions.length));
            }
        }

        private static readonly COMMAND_NAME_GET_USER: string = "get-user";
        private static readonly COMMAND_DESC_GET_USER: string = "Gets the current user email";
        private static readonly ACTION_DESC_GET_USER: string = "User email address set to: ";
        private static readonly ACTION_DESC_GET_USER_NOT_SET: string = "User email address not set!";

        private static readonly COMMAND_NAME_SET_USER: string = "set-user [email]";
        private static readonly COMMAND_DESC_SET_USER: string = "Sets the user email address. Passing no values unsets the user email address.";
        private static readonly ACTION_DESC_SET_USER: string = "Setting user email address to: ";
        private static readonly ACTION_DESC_SET_USER_EMPTY: string = "Unsetting user email address";

        private static readonly COMMAND_NAME_GET_USER_ORDER: string = "get-user-order";
        private static readonly COMMAND_DESC_GET_USER_ORDER: string = "Gets the user's experiment order";
        private static readonly ACTION_DESC_GET_USER_ORDER: string = "User's experiment order is: ";
        private static readonly ACTION_DESC_GET_USER_ORDER_NOT_SET: string = "User's experiment order not set (probably as there is no user email).";

        private userEmail: string = "";
        private userNumbers: number[] = [];
        //private randomNumGen: Chance.Chance = Chance.Chance();
    }
}