var bob, hintCount, toastTimer;

function yummyToast(msg) {
    let x = document.getElementById("toast");
    x.innerText = msg;
    x.style.left = Math.round(bob.topleftX + ((bob.bottomrightX - bob.topleftX) / 2) - (x.clientWidth / 2)) + "px";
    // Restart the animation and timer so a new toast isn't cut short by the previous one's timeout.
    clearTimeout(toastTimer);
    x.className = "";
    void x.offsetWidth;
    x.className = "show";
    toastTimer = setTimeout(function () {
        x.className = x.className.replace("show", "");
    }, 3000);
}

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

// A token counts as an article only if, ignoring surrounding punctuation, it is exactly
// "the", "a" or "an". (The old /\ba\b/ test also hid things like "a.m." and "U.S.A.")
var ARTICLE_PATTERN = /^[^\w]*(the|a|an)[^\w]*$/i;

var tries, articles, articleCount;
var gameActive = false;
var pendingArticle = null;   // hidden article whose next word was just clicked
var targetToArticle = null;  // word span -> hidden article span before it
var hintTimer = null;
var listenersAttached = false;

function customPop(a, b, c, d, e, f) {
} // have to declare it to prevent error

function articleWord(el) {
    const m = ARTICLE_PATTERN.exec(el.textContent);
    return m ? m[1].toLowerCase() : null;
}

// Next word span after el, skipping the <br>s that mark line breaks.
function nextWord(el) {
    let n = el.nextElementSibling;
    while (n && n.tagName !== "SPAN") n = n.nextElementSibling;
    return n;
}

function textAreaSize() {
    let el = document.getElementById("terry");
    let leftXY = getPosition(el);
    let right = leftXY.x + el.clientWidth;
    let bottom = leftXY.y + el.clientHeight;
    return { // returns a javascript object containing variables describing all corners of a dom object, used for positioning
        topleftX: leftXY.x,
        topleftY: leftXY.y,
        bottomrightX: right,
        bottomrightY: bottom
    }
}

function spanTerry() {
    const terry = document.getElementById("terry");
    const lines = terry.innerText.split(/\r?\n/);
    terry.textContent = "";
    // Build the spans with textContent rather than innerHTML, so pasted text containing
    // < or & shows up as typed instead of being parsed as HTML. Keep the line breaks too.
    lines.forEach(function (line, idx) {
        if (idx > 0) terry.appendChild(document.createElement("br"));
        line.split(/\s+/).forEach(function (word) {
            if (word.length > 0) {
                const span = document.createElement("span");
                span.textContent = word;
                terry.appendChild(span);
            }
        });
    });
}

function pastey(e) {
    e.preventDefault();
    if (gameActive) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    const dataToPaste = clipboardData.getData("text/plain");
    let el = document.getElementById("terry");
    el.innerText = dataToPaste;
    el.setAttribute("spellcheck", "false");
    prepArticles();
}

function hidePicker() {
    document.getElementById("picker").style.display = "none";
    pendingArticle = null;
}

function onWordClick(e) {
    if (!gameActive) return;
    const span = e.target.closest("span");
    if (!span || span.parentElement !== this) return;

    ++tries;
    const article = targetToArticle.get(span);
    if (!article || article.classList.contains("found")) {
        hidePicker();
        return;
    }

    // Recalculate here: the page may have scrolled since the text was pasted.
    bob = textAreaSize();
    const picker = document.getElementById("picker");
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

    const found = pendingArticle;
    found.classList.add("found");
    found.style.display = "inline";
    found.style.color = "";
    found.style.fontWeight = "";
    hidePicker();
    --articleCount;
    if (articleCount === 0) {
        gameActive = false;
        document.getElementById("btnHint").style.display = "none";
        let msg = "all done\nYour score is " + Math.round(100 * articles / tries) + "%";
        msg = hintCount > 0 ? msg + "\nBut you used " + hintCount + (hintCount === 1 ? " hint" : " hints ㅠㅠ") : msg;
        bob = textAreaSize();
        yummyToast(msg);
    }
}

function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    document.getElementById("terry").addEventListener("click", onWordClick);
    ["the", "a", "an"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", checky);
    });
}

function prepArticles() {
    attachListeners();
    spanTerry();
    const dom = Array.prototype.slice.call(document.getElementById("terry").getElementsByTagName("span"));
    tries = 0;
    articles = 0;
    bob = textAreaSize();
    hintCount = 0;
    targetToArticle = new Map();
    hidePicker();

    dom.forEach(function (el) {
        if (!articleWord(el)) return;
        const target = nextWord(el);
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
    yummyToast("There " + (articles === 1 ? "is 1 article" : "are " + articles + " articles") + " in this text.");
    if (gameActive) {
        document.getElementById("btnHint").style.display = "inline-block";
        document.getElementById("instructions").style.display = "inline";
    }
    document.getElementById("terry").blur();
    document.getElementById("terry").setAttribute("contenteditable", "false");
    document.getElementById("terry").setAttribute("readonly", "readonly");
}

function showHint() {
    if (!gameActive || hintTimer) return; // ignore clicks while a hint is already showing
    ++hintCount;
    const hidden = Array.prototype.filter.call(
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
