import {
  acceptRoomRequest,
  assignPresenter,
  createRoom,
  endMeeting,
  getPendingRequests,
  getRoomMembers,
  joinRoom,
  leaveRoom,
  login,
  logout,
  register,
  setMemberDrawPermission,
} from "./services/authService.js";
import "./index.css";
import {
  connectSocket,
  forgetSocketRoom,
  getSocket,
  joinSocketRoom,
} from "./services/socketService.js";

const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const authForms = document.querySelector(".auth-grid");
const logoutButton = document.querySelector("#logout-button");
const statusMessage = document.querySelector("#status");
const roomActions = document.querySelector("#room-actions");
const createRoomButton = document.querySelector("#create-room-button");
const joinRoomForm = document.querySelector("#join-room-form");
const roomResult = document.querySelector("#room-result");
const pendingRequestsPanel = document.querySelector("#pending-requests-panel");
const pendingRequestsList = document.querySelector("#pending-requests-list");
const pendingRequestsEmpty = document.querySelector("#pending-requests-empty");
const refreshRequestsButton = document.querySelector("#refresh-requests-button");
const roomMembersPanel = document.querySelector("#room-members-panel");
const roomMembersList = document.querySelector("#room-members-list");
const roomDrawStatus = document.querySelector("#room-draw-status");
const activeRoomControls = document.querySelector("#active-room-controls");
const leaveRoomButton = document.querySelector("#leave-room-button");
const endMeetingButton = document.querySelector("#end-meeting-button");
const socket = getSocket();
let activeToken;
let activeUserId;
let activeRoomId;
let activeRoomRole;
let waitingRoomId;

function showStatus(message) {
  statusMessage.textContent = message;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form));
}

function showRoom(room, action) {
  roomResult.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = action === "created" ? "Room created" : "Room joined";
  const code = document.createElement("p");
  code.textContent = `Room code: ${room.roomCode}`;
  const details = document.createElement("p");
  details.textContent = `Your role: ${room.role}`;
  roomResult.append(heading, code, details);

  if (room.membershipStatus === "waiting") {
    const waiting = document.createElement("p");
    waiting.textContent = "Status: Waiting for host approval";
    roomResult.append(waiting);
  }
}

function updateRoomControls(canDraw = false) {
  activeRoomControls.hidden = !activeRoomId;
  endMeetingButton.hidden = activeRoomRole !== "host";
  roomDrawStatus.hidden = !activeRoomId || !canDraw;
  roomDrawStatus.textContent = canDraw
    ? "Drawing permission enabled. Drawing controls will be available with the canvas."
    : "";
}

function clearActiveRoom() {
  if (activeRoomId) forgetSocketRoom(activeRoomId);
  activeRoomId = undefined;
  activeRoomRole = undefined;
  waitingRoomId = undefined;
  pendingRequestsPanel.hidden = true;
  pendingRequestsList.replaceChildren();
  roomMembersPanel.hidden = true;
  roomMembersList.replaceChildren();
  roomDrawStatus.hidden = true;
  activeRoomControls.hidden = true;
  endMeetingButton.hidden = true;
  roomResult.replaceChildren();
}

function renderPendingRequests(requests) {
  pendingRequestsList.replaceChildren();
  pendingRequestsEmpty.hidden = requests.length > 0;

  for (const request of requests) {
    const item = document.createElement("li");
    item.className = "pending-request";
    const details = document.createElement("strong");
    details.textContent = request.displayName;
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.textContent = "Accept";
    approveButton.addEventListener("click", async () => {
      approveButton.disabled = true;
      try {
        await acceptRoomRequest(activeToken, activeRoomId, request.userId);
        showStatus(`${request.displayName} was accepted into the room.`);
        await Promise.all([refreshPendingRequests(), refreshRoomMembers()]);
      } catch (error) {
        showStatus(`Could not accept request: ${error.message}`);
        approveButton.disabled = false;
      }
    });
    item.append(details, approveButton);
    pendingRequestsList.append(item);
  }
}

async function refreshPendingRequests() {
  if (!activeRoomId || activeRoomRole !== "host" || !activeToken) return;

  refreshRequestsButton.disabled = true;
  try {
    const result = await getPendingRequests(activeToken, activeRoomId);
    renderPendingRequests(result.requests);
  } catch (error) {
    showStatus(`Could not load pending requests: ${error.message}`);
  } finally {
    refreshRequestsButton.disabled = false;
  }
}

function renderRoomMembers(members) {
  roomMembersList.replaceChildren();
  roomMembersPanel.hidden = members.length === 0;
  const currentUser = members.find((member) => member.userId === activeUserId);
  updateRoomControls(currentUser?.canDraw ?? false);

  for (const member of members) {
    const item = document.createElement("li");
    item.className = "room-member";

    const identity = document.createElement("div");
    const name = document.createElement("div");
    name.className = "member-name";
    const displayName = document.createElement("strong");
    displayName.textContent = member.displayName;
    name.append(displayName);
    if (member.isPresenter) {
      const badge = document.createElement("span");
      badge.className = "presenter-badge";
      badge.textContent = "Presenter";
      name.append(badge);
    }
    const role = document.createElement("p");
    role.textContent = member.role;
    identity.append(name, role);
    item.append(identity);

    if (activeRoomRole === "host" && member.role !== "host") {
      const actions = document.createElement("div");
      actions.className = "member-actions";

      const permissionLabel = document.createElement("label");
      permissionLabel.className = "draw-permission";
      const permissionInput = document.createElement("input");
      permissionInput.type = "checkbox";
      permissionInput.checked = member.canDraw;
      permissionInput.setAttribute(
        "aria-label",
        `Allow ${member.displayName} to draw`,
      );
      permissionInput.addEventListener("change", async () => {
        permissionInput.disabled = true;
        try {
          await setMemberDrawPermission(
            activeToken,
            activeRoomId,
            member.userId,
            permissionInput.checked,
          );
          await refreshRoomMembers();
        } catch (error) {
          showStatus(`Could not update drawing permission: ${error.message}`);
          permissionInput.checked = member.canDraw;
          permissionInput.disabled = false;
        }
      });
      permissionLabel.append(permissionInput, "Can draw");
      actions.append(permissionLabel);

      if (!member.isPresenter) {
        const presenterButton = document.createElement("button");
        presenterButton.type = "button";
        presenterButton.className = "secondary-button small-button";
        presenterButton.textContent = "Make presenter";
        presenterButton.addEventListener("click", async () => {
          presenterButton.disabled = true;
          try {
            await assignPresenter(activeToken, activeRoomId, member.userId);
            await refreshRoomMembers();
            showStatus(`${member.displayName} is now the presenter.`);
          } catch (error) {
            showStatus(`Could not assign presenter: ${error.message}`);
            presenterButton.disabled = false;
          }
        });
        actions.append(presenterButton);
      }

      item.append(actions);
    } else {
      const permission = document.createElement("p");
      permission.textContent = member.canDraw ? "Can draw" : "View only";
      item.append(permission);
    }
    roomMembersList.append(item);
  }
}

async function refreshRoomMembers() {
  if (!activeRoomId || !activeToken || waitingRoomId === activeRoomId) return;

  try {
    const result = await getRoomMembers(activeToken, activeRoomId);
    renderRoomMembers(result.members);
  } catch (error) {
    showStatus(`Could not load room members: ${error.message}`);
  }
}

function setAuthenticated(isAuthenticated) {
  roomActions.hidden = !isAuthenticated;
  authForms.hidden = isAuthenticated;
  logoutButton.disabled = !isAuthenticated;
}

socket.on("connect", () => {
  showStatus(`Socket connected (${socket.id})`);
});

socket.on("connection:ready", () => {
  showStatus("Signed in and connected");
});

socket.on("connect_error", (error) => {
  showStatus(`Socket connection failed: ${error.message}`);
});

socket.on("room:request", ({ roomId }) => {
  if (roomId === activeRoomId && activeRoomRole === "host") {
    refreshPendingRequests();
  }
});

socket.on("room:accepted", ({ roomId }) => {
  if (roomId === waitingRoomId) {
    waitingRoomId = undefined;
    const status = roomResult.querySelector("p:last-child");
    if (status) status.textContent = "Status: Accepted by the host";
    showStatus("The host approved your request. You are now in the room.");
    refreshRoomMembers();
  }
});

socket.on("room:members:updated", ({ roomId }) => {
  if (roomId === activeRoomId) {
    refreshRoomMembers();
  }
});

socket.on("room:ended", ({ roomId }) => {
  if (roomId === activeRoomId) {
    clearActiveRoom();
    showStatus("The host ended the meeting.");
  }
});

socket.on("room:left", ({ roomId, userId }) => {
  if (roomId === activeRoomId && userId === activeUserId) {
    clearActiveRoom();
    showStatus("You left the room.");
  }
});

socket.on("room:sync:error", ({ error }) => {
  showStatus(error ?? "Could not synchronize approved room connections.");
});

refreshRequestsButton.addEventListener("click", refreshPendingRequests);

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Creating account...");

  try {
    await register(formValues(registerForm));
    registerForm.reset();
    showStatus("Account created. Sign in to connect.");
  } catch (error) {
    showStatus(`Registration failed: ${error.message}`);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Signing in...");

  try {
    const result = await login(formValues(loginForm));
    activeToken = result.token;
    activeUserId = result.user.id;
    setAuthenticated(true);
    showStatus(`Signed in as ${result.user.displayName}; connecting...`);
    connectSocket(result.token);
  } catch (error) {
    showStatus(`Sign-in failed: ${error.message}`);
  }
});

createRoomButton.addEventListener("click", async () => {
  createRoomButton.disabled = true;
  showStatus("Creating room...");

  try {
    const result = await createRoom(activeToken);
    clearActiveRoom();
    activeRoomId = result.room.roomId;
    activeRoomRole = result.room.role;
    showRoom(result.room, "created");
    updateRoomControls(result.room.canDraw);
    pendingRequestsPanel.hidden = false;

    try {
      await joinSocketRoom(activeRoomId);
      showStatus("Room created and live connection joined.");
    } catch (error) {
      showStatus(`Room created, but live connection failed: ${error.message}`);
    }

    await Promise.all([refreshPendingRequests(), refreshRoomMembers()]);
  } catch (error) {
    showStatus(`Could not create room: ${error.message}`);
  } finally {
    createRoomButton.disabled = false;
  }
});

joinRoomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = joinRoomForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showStatus("Checking room...");

  try {
    const result = await joinRoom(activeToken, formValues(joinRoomForm).roomCode);
    clearActiveRoom();
    activeRoomId = result.room.roomId;
    activeRoomRole = result.room.role;
    showRoom(result.room, "joined");
    updateRoomControls(result.room.canDraw);
    joinRoomForm.reset();

    if (result.room.membershipStatus === "waiting") {
      waitingRoomId = result.room.roomId;
      showStatus("Your request is waiting for host approval.");
    } else {
      pendingRequestsPanel.hidden = activeRoomRole !== "host";
      try {
        await joinSocketRoom(activeRoomId);
        showStatus("Joined room and connected to its live session.");
      } catch (error) {
        showStatus(`Joined the room, but live connection failed: ${error.message}`);
      }

      if (activeRoomRole === "host") await refreshPendingRequests();
      await refreshRoomMembers();
    }
  } catch (error) {
    showStatus(`Could not join room: ${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
});

leaveRoomButton.addEventListener("click", async () => {
  if (!activeRoomId) return;
  leaveRoomButton.disabled = true;
  try {
    await leaveRoom(activeToken, activeRoomId);
    forgetSocketRoom(activeRoomId);
    clearActiveRoom();
    showStatus("You left the room.");
  } catch (error) {
    showStatus(`Could not leave room: ${error.message}`);
  } finally {
    leaveRoomButton.disabled = false;
  }
});

endMeetingButton.addEventListener("click", async () => {
  if (!activeRoomId || !window.confirm("End the meeting for everyone in this room?")) {
    return;
  }

  endMeetingButton.disabled = true;
  try {
    await endMeeting(activeToken, activeRoomId);
    forgetSocketRoom(activeRoomId);
    clearActiveRoom();
    showStatus("Meeting ended. Participants remain connected to the app.");
  } catch (error) {
    showStatus(`Could not end meeting: ${error.message}`);
  } finally {
    endMeetingButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  showStatus("Signing out...");

  try {
    await logout(activeToken);
    showStatus("Signed out");
  } catch (error) {
    showStatus(`Signed out locally; server logout failed: ${error.message}`);
  } finally {
    activeToken = undefined;
    activeUserId = undefined;
    clearActiveRoom();
    setAuthenticated(false);
  }
});
