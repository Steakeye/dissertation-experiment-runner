import os from 'os';
import Vorpal from 'vorpal';
import NodePersist from 'node-persist';
import appRoot from 'app-root-path'

export namespace vorpal_appdata {

    export interface VorpalAppdataFSOptions {
        encoding?: string | null;
        mode?: number | string;
        flag?: string;
    }

    export interface VorpalAppdataInitOptions {
        dir?: string;
        stringify?: (toSerialize: any) => string;
        parse?: (serialized: string) => any;
        encoding?: VorpalAppdataFSOptions | string;
        logging?: boolean | Function;
        continuous?: boolean;
        interval?: number | boolean;
        ttl?: number | boolean;
    }

    export interface NodePersistAPI {
        init(options?: VorpalAppdataInitOptions, callback?: Function): Q.Promise<any>;
        initSync(options?: VorpalAppdataInitOptions): void;
        getItem(key: string, callback?: (err: any, value: any) => any): Q.Promise<any>;
        getItemSync(key: string): any;
        setItem(key: string, value: any, callback?: (err: any) => any): Q.Promise<any>;
        setItemSync(key: string, value: any): void;
        removeItem(key: string, callback?: (err: any) => any): Q.Promise<any>;
        removeItemSync(key: string): void;
        clear(callback?: (err: any) => any): Q.Promise<any>;
        clearSync(): void;
        values(): Array<any>;
        valuesWithKeyMatch(match: string): Array<any>;
        keys(): Array<string>;
        length(): number;
        forEach(callback: (key: string, value: any) => void): void;

        persist(callback?: (err: any) => any): Q.Promise<any>;
        persistSync(): void;
        persistKey(key: string, callback?: (err: any) => any): Q.Promise<any>;
        persistKeySync(key: string): void;
    }

    export interface VorpalWithAppdata extends Vorpal {
        appData:NodePersistAPI;
    }

    export function VorpalAppdata(vorpal: Vorpal, appName?: any): void {
        const env = process.env;
        const appDataRoot = (env.APPDATA || env.HOME + '/' + (process.platform == 'darwin' ? 'Library/Preferences' : '.local/share')) + '/';

        if (!appName) {
            const folderDelim: string = os.platform() == "win32" ? '\\' : '/';
            const folders: string[] = appRoot.path.split(folderDelim);
            appName = folders[folders.length - 1];
        }

        NodePersist.init({
            dir: appDataRoot + appName
        });

        (<VorpalWithAppdata>vorpal).appData = NodePersist;
    }
}