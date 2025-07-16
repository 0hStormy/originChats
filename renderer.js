if (localStorage.getItem("currentServer")) {
    currentServer = localStorage.getItem("currentServer");
} else {
    localStorage.setItem("currentServer", "wss://chats.mistium.com");
    currentServer = localStorage.getItem("currentServer");
}

let state = {
    _currentChannel: "general",

    set currentChannel(value) {
        this._currentChannel = value;
        ws.send(JSON.stringify({ 
            cmd: 'messages_get',
            channel: value
        }));
    },

    get currentChannel() {
        return this._currentChannel;
    }
};

let ws = new WebSocket(currentServer);
ws.onopen = () => console.log("WebSocket connected!");

async function roturAuth() {
    let token;
    const username = document.getElementById("userInput").value;
    const password = document.getElementById("passInput").value;

    try {
        const response = await fetch(`https://social.rotur.dev/get_user?username=${username}&password=${CryptoJS.MD5(password).toString()}`);
        const data = await response.json();

        if (data.error) {
            document.getElementById("errorBox").setAttribute("style", "display: flex;")
            throw new Error(data.error);
        }

        token = data["key"];
        const validatorResponse = await fetch(`https://social.rotur.dev/generate_validator?auth=${token}&key=originChats-iswt`);
        const validatorData = await validatorResponse.json();
        localStorage.setItem("validator", validatorData["validator"]);
        document.getElementById("authPrompt").remove();
        location.reload();

    } catch (error) {
        console.error("Error:", error);
    }
}

function auth() {
    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            console.log("WebSocket connected, sending auth...");
            const authMessage = {
                cmd: "auth",
                validator: localStorage.getItem("validator")
            };
            console.log("Sending auth:", JSON.stringify(authMessage));
            ws.send(JSON.stringify(authMessage));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Response:", data);

            switch (data.cmd) {
                case 'auth_success':
                    console.log("Authentication successful, requesting channels...");
                    
                    ws.send(JSON.stringify({ 
                        cmd: 'channels_get'
                    }));

                    ws.send(JSON.stringify({ 
                        cmd: 'messages_get',
                        channel: state.currentChannel
                    }));

                    const input = document.getElementById("chatInput")
                    input.addEventListener("keydown", (event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            ws.send(JSON.stringify({ 
                                cmd: 'message_new',
                                content: input.value,
                                channel: state.currentChannel
                            }));
                            input.value = ""
                        }
                    });

                    break;

                case 'message_new':
                    resolve(data);
                    addMessage(data)

                case 'channels_get':
                    console.log("Channels received successfully");
                    resolve(data);
                    if (data["val"] != undefined) {
                        listChannels(data["val"]);
                    }
                    break;

                case 'messages_get':
                    console.log("Channels received successfully");
                    resolve(data);
                    listMessages(data["messages"])
                    break;

                case 'auth_error':
                    reject(new Error(data.val || 'Authentication failed'));
                    break;

                case 'handshake':
                    const rawdata = event.data;
                    let jsonData;
                    if (typeof rawdata === "string") {
                        try {
                            jsonData = JSON.parse(rawdata);
                        } catch (e) {
                            console.error("Failed to parse JSON:", e);
                            return;
                        }
                    } else {
                        jsonData = rawdata;
                    }

                    document.getElementById("currentServerIcon")?.setAttribute("src", jsonData?.val?.server?.icon || "");
                    break;

                case 'error':
                    reject(new Error(data.message || 'Unknown error'));
                    break;

                default:
                    console.log("Unhandled message:", data);
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            reject(error);
        };
    });
}

function listChannels(channelList) {
    const sidebar = document.getElementById("sidebar");
    sidebar.innerHTML = "";

    for (let channel of channelList) {
        let newChannel = null;

        if (channel["type"] === "text") {
            newChannel = document.createElement("a");
            newChannel.id = `channel_${state.currentChannel}`
            newChannel.innerHTML = `#${channel["name"]}`;
            newChannel.setAttribute("onclick", `changeChannel('${channel["name"]}')`);
        } else if (channel["type"] === "separator") {
            newChannel = document.createElement("hr");
        }

        if (newChannel) {
            sidebar.appendChild(newChannel);
        } else {
            console.warn("Unknown channel type:", channel);
        }
    }
}

function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}


function listMessages(messageList) {
    const chatArea = document.getElementById("main");
    chatArea.innerHTML = '';

    for (let message of messageList) {
        const wrapper = document.createElement("div");
        const timestamp = message["timestamp"];
        const date = new Date(timestamp * 1000);

        const plainText = stripHtml(message["content"]);
        const mdText = marked.parse(plainText);

        wrapper.innerHTML = `
<div id="message">
    <img src="https://avatars.rotur.dev/${message["user"]}" alt="">
    <div class="vert">
        <span>${message["user"]} - ${date.toLocaleString()}</span>
        <span>${mdText}</span>
    </div>
</div>
        `.trim();

        chatArea.appendChild(wrapper.firstElementChild);
    }

    chatArea.scrollTop = chatArea.scrollHeight;
}

function addMessage(messagePacket) {
    const chatArea = document.getElementById("main");
    if (state.currentChannel == messagePacket["channel"]) {
        message = messagePacket["message"]
        const wrapper = document.createElement("div");
        const timestamp = message["timestamp"];
        const date = new Date(timestamp * 1000);

        const plainText = stripHtml(message["content"]);
        const mdText = marked.parse(plainText);

        wrapper.innerHTML = `
<div id="message">
    <img src="https://avatars.rotur.dev/${message["user"]}" alt="">
    <div class="vert">
        <span>${message["user"]} - ${date.toLocaleString()}</span>
        <span>${mdText}</span>
    </div>
</div>
        `.trim();

        chatArea.appendChild(wrapper.firstElementChild);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

function changeChannel(channel) {
    state.currentChannel = channel;
}

if (localStorage.getItem("validator")) {
    document.getElementById("authPrompt").remove();
    auth();
}

if (window.api?.isElectron) {
    console.log("Electron");
} else {
    console.log("Browser");
    const tb = document.querySelector(".titlebar");
    if (tb) tb.setAttribute("style", "display: none; opacity: 0%;");
}


if (document.getElementById('close-button')) {
    document.getElementById('close-button').addEventListener('click', () => {
        window.api.sendWindowControl('close');
    });
}
if (document.getElementById('max-button')) {
    document.getElementById('max-button').addEventListener('click', () => {
        window.api.sendWindowControl('maximize');
    });
}
if (document.getElementById('min-button')) {
    document.getElementById('min-button').addEventListener('click', () => {
        window.api.sendWindowControl('minimize');
    });
}

const input = document.getElementById("serverInput")
input.setAttribute("value", localStorage.getItem("currentServer"))
input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        localStorage.setItem("currentServer", input.value);
        location.reload();
    }
});