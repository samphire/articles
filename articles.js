var bob, hintCount;

function yummyToast(msg) {
    let x = document.getElementById("toast");
    x.innerText = msg;
    x.style.left = Math.round(bob.topleftX + ((bob.bottomrightX - bob.topleftX) / 2) - (x.clientWidth / 2)) + "px";
    x.className = "show";
    setTimeout(function () {
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

var tries, articles, articleCount, spanText, elHidden;

function customPop(a, b, c, d, e, f) {
} // have to declare it to prevent error


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
    const text = document.getElementById("terry").innerText;
    console.log("innerText: " + text);
    let TextArr = text.split(/[\r\n ]/g);
    console.log(TextArr.length);
    for (let i = 0; i < TextArr.length; i++) {
        if (TextArr[i].length > 0) {
            TextArr[i] = "<span>" + TextArr[i] + "</span>";
        }
    }
    let myString = "";

    TextArr.forEach(function (item, idx, arr) {
        myString += item;
    });
    document.getElementById('terry').innerHTML = myString;
    console.log(myString);
}

function pastey(e) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    const dataToPaste = clipboardData.getData("text/plain");
    console.log("\n\ndataToPaste: " + dataToPaste + "\n\n");
    let el=document.getElementById("terry");
    // el.setAttribute("pasted", null);
    // el.removeChild(el.firstChild);
    // el.textContent = "";
    el.innerText = dataToPaste;
    el.setAttribute("spellcheck", "false");
    //spanTerry();
    prepArticles();
}

function prepArticles() {
    spanTerry();
    const picker = document.getElementById("picker");
    const patt = /(\bthe\b|\ba\b|\ban\b)/i; //the modifer \b means 'word boundary'. So having one at the start and end of the regex means 'match whole word'
    const dom = document.getElementById("terry").getElementsByTagName("span"); //nodelist, not array
    tries = 0;
    articles = 0;
    bob = textAreaSize();
    hintCount = 0;
    articleCount = 0;

    function checky() {
        if (new RegExp("\\b" + spanText + "\\b", "i").test("" + this.id)) {
            elHidden.style.display = "inline";
            document.getElementById("picker").style.display = "none";
            --articleCount;
            if (articleCount === 0) {
                let msg = "all done\nYour score is " + Math.round(100 * articles / tries) + "%";
                msg = hintCount > 0 ? msg + "\nBut you used " + hintCount + (hintCount === 1 ? " hint" : " hints ㅠㅠ") : msg;
                yummyToast(msg);
            }
        } else {
            tries += 1;
        }
    }

    Array.prototype.forEach.call(dom, function (el) { // this is a hack. should use for loop instead

        el.addEventListener("click", function () {
            ++tries;
        });

        if (patt.test(el.textContent)) {
            articles++;
            el.classList.add("article");
            el.style.display = "none";
            el.nextElementSibling.addEventListener("click", function (e) {
                // Setting picker x
                picker.style.left = (e.clientX - 80) + "px";
                if ((e.clientX - 80) < bob.topleftX) picker.style.left = e.clientX + "px";
                if ((e.clientX + 80) > bob.bottomrightX) picker.style.left = (e.clientX - 160) + "px";
                // Setting picker y
                picker.style.top = (e.clientY + 40) > bob.bottomrightY ? (e.clientY - 40) + "px" : (e.clientY + 30) + "px";

                picker.style.display = "block";
                spanText = el.textContent;
                document.getElementById("the").addEventListener("click", checky);
                document.getElementById("a").addEventListener("click", checky);
                document.getElementById("an").addEventListener("click", checky);
                elHidden = el; // global var
            });
        }
    });
    yummyToast("There are " + articles + " articles in this text.");
    articleCount = articles;
    document.getElementById("btnHint").style.display = "inline-block";
    document.getElementById("instructions").style.display = "inline";
}

function showHint() {
    ++hintCount;
    let oldFontWeight, oldColor;
    const dom = document.getElementById("terry").getElementsByTagName("span");
    [].forEach.call(dom, function (el) {
        if (el.style.display === "none") {
            oldFontWeight = el.style.fontWeight;
            oldColor = el.style.color;
            el.style.display = "inline";
            el.style.fontWeight = "bolder";
            el.style.color = "red";
        }
    });
    setTimeout(function () {
        [].forEach.call(dom, function (el) {
            if (el.style.color === "red") {
                el.style.color = oldColor;
                el.style.fontWeight = oldFontWeight;
                el.style.display = "none";
            }
        });
    }, 2000);

}