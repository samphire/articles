"use strict";

/* ===================== Saved player data =====================
 * One player per device. Everything lives in localStorage, which the
 * installed (TWA/PWA) app keeps between launches.
 *   name       player's name
 *   completed  { textId: true } for finished library texts
 *   games      [{ score, textId|null, at }] one entry per finished game
 */
var STORE_KEY = "articleTrainer.v1";
var state = loadState();

function loadState() {
    var fresh = { name: "", completed: {}, games: [] };
    try {
        var saved = JSON.parse(localStorage.getItem(STORE_KEY));
        if (saved && typeof saved === "object") {
            return {
                name: typeof saved.name === "string" ? saved.name : "",
                completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
                games: Array.isArray(saved.games) ? saved.games : []
            };
        }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return fresh;
}

function saveState() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode etc.: the game still works, it just won't remember */ }
}

/* ===================== Text library ===================== */
var library = [];        // [{ id, level, length, title, text }] from texts.json
var currentText = null;  // library entry being played, or null for a pasted text

var LEVEL_NAMES = { easy: "쉬움", medium: "보통", hard: "어려움" };
var LENGTH_NAMES = { short: "짧게", medium: "보통", long: "길게" };

function loadLibrary() {
    return fetch("texts.json")
        .then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        })
        .then(function (data) { library = data; })
        .catch(function () {
            library = [];
            yummyToast("텍스트를 불러올 수 없습니다.");
        });
}

function selected(name) {
    return document.querySelector("input[name=" + name + "]:checked").value;
}

function textsFor(level, length) {
    return library.filter(function (t) { return t.level === level && t.length === length; });
}

function unplayed(level, length) {
    return textsFor(level, length).filter(function (t) { return !state.completed[t.id]; });
}

/* ===================== Screens ===================== */
function showScreen(id) {
    hidePicker();
    Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) {
        s.hidden = s.id !== id;
    });
    window.scrollTo(0, 0);
}

function showHome() {
    gameActive = false;
    if (!state.name) {
        showScreen("nameScreen");
        document.getElementById("nameInput").focus();
        return;
    }
    renderStats();
    renderRemaining();
    showScreen("homeScreen");
}

function renderStats() {
    var scores = state.games.map(function (g) { return g.score; });
    document.getElementById("greeting").textContent = state.name + "님, 안녕하세요!";
    document.getElementById("statGames").textContent = scores.length;
    if (scores.length === 0) {
        ["statMax", "statMin", "statAvg"].forEach(function (id) {
            document.getElementById(id).textContent = "–";
        });
        return;
    }
    var sum = scores.reduce(function (a, b) { return a + b; }, 0);
    document.getElementById("statMax").textContent = Math.max.apply(null, scores) + "%";
    document.getElementById("statMin").textContent = Math.min.apply(null, scores) + "%";
    document.getElementById("statAvg").textContent = Math.round(sum / scores.length) + "%";
}

function renderRemaining() {
    var level = selected("level"), length = selected("length");
    var total = textsFor(level, length).length;
    document.getElementById("remaining").textContent =
        total ? "남은 텍스트: " + unplayed(level, length).length + " / " + total : "";
}

/* ===================== Starting games ===================== */
function newLibraryGame() {
    var level = selected("level"), length = selected("length");
    var choices = unplayed(level, length);
    if (choices.length === 0) {
        if (textsFor(level, length).length === 0) {
            yummyToast("텍스트를 불러올 수 없습니다.");
            return;
        }
        var label = LEVEL_NAMES[level] + " / " + LENGTH_NAMES[length];
        if (window.confirm("축하합니다! " + label + " 텍스트를 모두 완료했습니다.\n처음부터 다시 하시겠습니까?")) {
            textsFor(level, length).forEach(function (t) { delete state.completed[t.id]; });
            saveState();
            renderRemaining();
            newLibraryGame();
        } else {
            showHome();
        }
        return;
    }
    var pick = choices[Math.floor(Math.random() * choices.length)];
    startGame(pick.text, pick);
}

function newClipboardGame() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        yummyToast("이 기기에서는 클립보드를 읽을 수 없습니다.");
        return;
    }
    navigator.clipboard.readText()
        .then(startPastedGame)
        .catch(function () {
            yummyToast("클립보드 접근이 거부되었습니다.");
        });
}

function startPastedGame(text) {
    text = (text || "").trim();
    if (!/[A-Za-z]/.test(text)) {
        yummyToast("클립보드에 영어 텍스트가 없습니다.");
        return;
    }
    startGame(text, null);
}

function startGame(text, libraryEntry) {
    currentText = libraryEntry;
    document.getElementById("gameTitle").textContent = libraryEntry
        ? libraryEntry.title + "  (" + LEVEL_NAMES[libraryEntry.level] + " / " + LENGTH_NAMES[libraryEntry.length] + ")"
        : "내 텍스트";
    document.getElementById("btnHint").hidden = false;
    document.getElementById("btnNext").hidden = true;
    showScreen("gameScreen");
    prepArticles(text);
    if (articles === 0) {
        showHome();
        yummyToast("이 텍스트에는 관사가 없습니다.");
    }
}

function finishGame() {
    var score = Math.min(100, Math.round(100 * articles / tries));
    state.games.push({ score: score, textId: currentText ? currentText.id : null, at: new Date().toISOString() });
    if (currentText) state.completed[currentText.id] = true;
    saveState();

    document.getElementById("btnHint").hidden = true;
    document.getElementById("btnNext").hidden = false;
    var msg = "all done\nYour score is " + score + "%";
    msg = hintCount > 0 ? msg + "\nBut you used " + hintCount + (hintCount === 1 ? " hint" : " hints ㅠㅠ") : msg;
    yummyToast(msg);
}

/* ===================== Toast ===================== */
var toastTimer;

function yummyToast(msg) {
    var x = document.getElementById("toast");
    x.innerText = msg;
    // Restart the animation and timer so a new toast isn't cut short by the previous one's timeout.
    clearTimeout(toastTimer);
    x.className = "";
    void x.offsetWidth;
    x.style.left = Math.max(0, Math.round((document.documentElement.clientWidth - x.offsetWidth) / 2)) + "px";
    x.className = "show";
    toastTimer = setTimeout(function () {
        x.className = x.className.replace("show", "");
    }, 3000);
}

/* ===================== The game ===================== */
function getPosition(el) {
    var xPosition = 0;
    var yPosition = 0;

    while (el) {
        if (el.tagName == "BODY") {
            // deal with browser quirks with body/window/document and page scroll
            var xScrollPos = el.scrollLeft || document.documentElement.scrollLeft;
            var yScrollPos = el.scrollTop || document.documentElement.scrollTop;

            xPosition += (el.offsetLeft - xScrollPos + el.clientLeft);
            yPosition += (el.offsetTop - yScrollPos + el.clientTop);
        } else {
            xPosition += (el.offsetLeft - el.scrollLeft + el.clientLeft);
            yPosition += (el.offsetTop - el.scrollTop + el.clientTop);
        }

        el = el.offsetParent;
    }
    return {
        x: xPosition,
        y: yPosition
    };
}

function textAreaSize() {
    var el = document.getElementById("terry");
    var leftXY = getPosition(el);
    return { // corners of the text box, used for positioning the picker
        topleftX: leftXY.x,
        topleftY: leftXY.y,
        bottomrightX: leftXY.x + el.clientWidth,
        bottomrightY: leftXY.y + el.clientHeight
    };
}

// A token counts as an article only if, ignoring surrounding punctuation, it is exactly
// "the", "a" or "an". (A plain /\ba\b/ test would also hide things like "a.m." and "U.S.A.")
var ARTICLE_PATTERN = /^[^\w]*(the|a|an)[^\w]*$/i;

var bob, hintCount, tries, articles, articleCount;
var gameActive = false;
var pendingArticle = null;   // hidden article whose next word was just clicked
var targetToArticle = null;  // word span -> hidden article span before it
var hintTimer = null;

function customPop(a, b, c, d, e, f) {
} // have to declare it to prevent error

function articleWord(el) {
    var m = ARTICLE_PATTERN.exec(el.textContent);
    return m ? m[1].toLowerCase() : null;
}

// Next word span after el, skipping the <br>s that mark line breaks.
function nextWord(el) {
    var n = el.nextElementSibling;
    while (n && n.tagName !== "SPAN") n = n.nextElementSibling;
    return n;
}

function spanTerry(text) {
    var terry = document.getElementById("terry");
    terry.textContent = "";
    // Build the spans with textContent rather than innerHTML, so text containing
    // < or & shows up as typed instead of being parsed as HTML. Keep the line breaks too.
    text.split(/\r?\n/).forEach(function (line, idx) {
        if (idx > 0) terry.appendChild(document.createElement("br"));
        line.split(/\s+/).forEach(function (word) {
            if (word.length > 0) {
                var span = document.createElement("span");
                span.textContent = word;
                terry.appendChild(span);
            }
        });
    });
}

function hidePicker() {
    document.getElementById("picker").style.display = "none";
    pendingArticle = null;
}

function onWordClick(e) {
    if (!gameActive) return;
    var span = e.target.closest("span");
    if (!span || span.parentElement !== this) return;

    ++tries;
    var article = targetToArticle.get(span);
    if (!article || article.classList.contains("found")) {
        hidePicker();
        return;
    }

    // Recalculate here: the page may have scrolled since the game started.
    bob = textAreaSize();
    var picker = document.getElementById("picker");
    // Setting picker x
    picker.style.left = (e.clientX - 80) + "px";
    if ((e.clientX - 80) < bob.topleftX) picker.style.left = e.clientX + "px";
    if ((e.clientX + 80) > bob.bottomrightX) picker.style.left = (e.clientX - 160) + "px";
    // Setting picker y
    picker.style.top = (e.clientY + 40) > bob.bottomrightY ? (e.clientY - 40) + "px" : (e.clientY + 30) + "px";
    picker.style.display = "block";
    pendingArticle = article;
}

function checky() {
    if (!gameActive || !pendingArticle) return;
    if (this.id !== articleWord(pendingArticle)) {
        tries += 1;
        return;
    }

    var found = pendingArticle;
    found.classList.add("found");
    found.style.display = "inline";
    found.style.color = "";
    found.style.fontWeight = "";
    hidePicker();
    --articleCount;
    if (articleCount === 0) {
        gameActive = false;
        finishGame();
    }
}

function prepArticles(text) {
    spanTerry(text);
    var dom = Array.prototype.slice.call(document.getElementById("terry").getElementsByTagName("span"));
    tries = 0;
    articles = 0;
    hintCount = 0;
    clearTimeout(hintTimer);
    hintTimer = null;
    targetToArticle = new Map();
    hidePicker();

    dom.forEach(function (el) {
        if (!articleWord(el)) return;
        var target = nextWord(el);
        // Only hide an article that has a clickable word after it. If the next word is
        // another article (or there is none), leave this one visible so the game can finish.
        if (!target || articleWord(target)) return;
        articles++;
        el.classList.add("article");
        el.style.display = "none";
        targetToArticle.set(target, el);
    });

    articleCount = articles;
    gameActive = articles > 0;
    bob = textAreaSize();
    if (gameActive) {
        yummyToast("There " + (articles === 1 ? "is 1 article" : "are " + articles + " articles") + " in this text.");
    }
}

function showHint() {
    if (!gameActive || hintTimer) return; // ignore clicks while a hint is already showing
    ++hintCount;
    var hidden = Array.prototype.filter.call(
        document.getElementById("terry").getElementsByClassName("article"),
        function (el) { return !el.classList.contains("found"); }
    );
    hidden.forEach(function (el) {
        el.style.display = "inline";
        el.style.fontWeight = "bolder";
        el.style.color = "red";
    });
    hintTimer = setTimeout(function () {
        hintTimer = null;
        hidden.forEach(function (el) {
            el.style.color = "";
            el.style.fontWeight = "";
            // Don't re-hide an article the student found while the hint was showing.
            if (!el.classList.contains("found")) el.style.display = "none";
        });
    }, 2000);
}

/* ===================== Wiring ===================== */
function init() {
    document.getElementById("terry").addEventListener("click", onWordClick);
    ["the", "a", "an"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", checky);
    });

    document.getElementById("nameForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("nameInput").value.trim();
        if (!name) return;
        state.name = name;
        saveState();
        showHome();
    });
    document.getElementById("changeName").addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("nameInput").value = state.name;
        showScreen("nameScreen");
        document.getElementById("nameInput").focus();
    });

    Array.prototype.forEach.call(document.querySelectorAll("input[name=level], input[name=length]"), function (r) {
        r.addEventListener("change", renderRemaining);
    });
    document.getElementById("btnNewGame").addEventListener("click", newLibraryGame);
    document.getElementById("btnClipboard").addEventListener("click", newClipboardGame);
    document.getElementById("btnHint").addEventListener("click", showHint);
    document.getElementById("btnHome").addEventListener("click", showHome);
    document.getElementById("btnNext").addEventListener("click", function () {
        if (currentText) newLibraryGame(); else showHome();
    });

    // Desktop: Ctrl/Cmd+V on the home screen also starts a game from the pasted text.
    document.addEventListener("paste", function (e) {
        if (document.getElementById("homeScreen").hidden) return;
        e.preventDefault();
        var data = e.clipboardData || window.clipboardData;
        startPastedGame(data.getData("text/plain"));
    });

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
    }

    showHome();
    loadLibrary().then(function () {
        if (!document.getElementById("homeScreen").hidden) renderRemaining();
    });
}

document.addEventListener("DOMContentLoaded", init);
