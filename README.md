## Running the chrome application (dev mode)
To run the application locally (i.e. not installed from the chrome store), clone this repository, install node (v0.12.x), then follow these steps:

- npm install gulp -g
- npm install
- gulp build
- In chrome, browse to chrome:extensions
- Turn on developer mode.
- Click the "Load unpacked extensions..." button.
- Browse to the dist directory of this project and click "Select".

When running in dev mode, the application will only communicate with a chrome-wallet running in dev mode.

**NOTE**: *It is possible to run the extension in dev mode when another version of the application installed from the chrome store is running. The will only cause heartache and and tears, so it is probably best to uninstall or disable the one from the chrome store before running the application in dev mode.*

## Command line interface
The CLI is located in the src/cli directory. To run, set src/cli/keepkey.js to be execuatable in your O/S. If you execute
`src/cli/keepkey.js`
you will get a help that describes the commands that are available in the CLI:
```
Usage: keepkey [options] [command]


  Commands:

    wipe                    Delete keys and configurations
    setup <label>           Initialize your device
    update                  Update firmware
    address <address_n...>  Get the address for a node
    public-key <address_n>  Get the public key for a node
    help [cmd]              display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```
Each of the subcommands has its own help output as well. Typing `src/cli/keepkey.js address --h` outputs a help screen for the address command.

### A Note About entering the address_n parameter
Keepkey assumes a [BIP32 HD addressing scheme](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) is being used. The address_n parameter is the path from the root node to node that you want the address for. The standard format for specifying the path is:
```
m/1'/33
```
where 'm' is the letter 'm', the '/' slashes separate nodes, the numbers indicate which child is selected at a particular level and the backtick (`) indicates a hardened node. In the example above, from the root, hardened child #1 is selected, then child #33 in the non-hardened address space. See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki for the details.

In order to enter an address_n, you will probably need to escape the single quotes (') used for indicating hardened nodes. In bash you can type:
```
src/cli/keepkey.js address m/44\'/0\'/1\'/0/0
```
### Note about entering your PIN in the CLI
When entering a pin, you need to enter the position of the number on the keypad displayed on your KeepKey device. The positions are:
```
+---+---+---+
| 7 | 8 | 9 |
+---+---+---+
| 4 | 5 | 6 |
+---+---+---+
| 1 | 2 | 3 |
+---+---+---+
```

If the device show the following PIN pad:
```
+---+---+---+
| 2 | 7 | 1 |
+---+---+---+
| 3 | 6 | 8 |
+---+---+---+
| 4 | 5 | 9 |
+---+---+---+
```

And your PIN is 1234, you would enter 9741.
