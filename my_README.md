# INSTRUCTIONS

From this folder, start a tiny web server

**Python:**

```.sh
python3 -m http.server 8000
```

then visit <http://localhost:8000>

**Node**
Node allows to connect both from localhost and network (you can access via your smartphone):

```.sh
npx serve
```

<https://playcanvas.com/model-viewer>
<https://playcanvas.com/model-viewer>

<https://superspl.at/editor?load=https://raw.githubusercontent.com/willeastcott/assets/main/biker.ply>

## Debugger

Launch the webserver

```sh
cd my_splat_testdir_project && npx serve; 
```

then attach debugger from vscode (`launch.json` below)

```.txt
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        { //For npx serve (adjust port to what serve prints, often 3000):
            "type": "pwa-chrome",
            "request": "launch",
            "name": "Chrome: my_splat (serve)",
            "url": "http://localhost:3000/index.html",
            "webRoot": "${workspaceFolder}/my_splat_testdir_project"
        }
    ]
}
```

### how to check your ip

<https://linuxconfig.org/how-to-find-my-ip-address-on-ubuntu-20-04-focal-fossa-linux>

```.sh
networkctl status
systemd-networkd is not running, output might be incomplete.
● Interfaces: n/a
       State: n/a
Online state: unknown
     Address: 192.168.0.66 on wlp5s0 <--------------------- this one
              172.17.0.1 on docker0
              2a02:a310:e188:3900:9443:ba59:2172:ed62 on wlp5s0
              2a02:a310:e188:3900:edc4:c3b1:3e1b:dc1e on wlp5s0
              fe80::ea5:cb0c:22e1:d659 on wlp5s0
     Gateway: 192.168.0.1 on wlp5s0
              fe80::b6f2:67ff:fe19:96d2 on wlp5s0
```

1. Generate trusted local certificates

```.sh
mkcert localhost 192.168.0.66 <-------------- your ip
```

This creates two files in your current directory:
localhost+192.168.0.66.pem → certificate
localhost+192.168.0.66-key.pem → private key

I renamed them to `cert.pem` and `key.pem` for convienience.

2. Start the HTTPS dev server with `serve`

```.sh
npm install --save-dev rollup
npm run build   
serve public -C --ssl-cert ./cert.pem --ssl-key ./key.pem -l 3000
```

### FAQ

### where to find some pretrained splat models

Open a PLY file formatted for 3DGS (eg. download the official pre-trained models) or a .splat file (use this script to convert from PLY)
<https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/pretrained/models.zip>
<https://github.com/antimatter15/splat/blob/main/convert.py>

#### npm run develop vs npx serve

***`npm run develop`***

Runs a script defined in your project’s package.json.

Example package.json:

{
  "scripts": {
    "develop": "vite --mode development"
  }
}

Then npm run develop executes that script.
Behavior depends entirely on what the project authors wrote. Could start a custom dev server, build pipeline, hot reload, etc.
It always uses your local project setup.

npx serve

Runs the CLI tool serve from npm.
That tool just starts a static file server:

***`npx serve` or just `serve`***

→ hosts the current folder at <http://localhost:3000>.

No build steps, no hot reload, no framework-specific features.
Useful only when you want to serve plain HTML/CSS/JS.

Key difference
`npm run develop` = project-specific dev command (often with bundling, hot reload, React/Vue/Svelte integration).
`npx serve` = generic static file server (just serves files, nothing else).
