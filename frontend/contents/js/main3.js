const url = 'https://www.sogumm.co.kr/conference/';
const rel = /^https:\/\/www.sogumm.co.kr\/conference\/#.{4,12}-.{1,5}$/gi;
const res = /^#.{4,12}-.{1,5}$/g;
const linkio = document.getElementById('header_linkio');
var temp;

function goSite() {
    if(rel.test(linkio.value) == true) {
        window.location.href = linkio.value;
    }
    else if(res.test(linkio.value) == true) {
        window.location.href = url+linkio.value;
    }
    else {
        temp = linkio.value;
        linkio.value = '';
        linkio.placeholder = '링크가 잘못됐어요.. 확인해 주세요!';
    }
}
function enterPress() {
    if (window.event.keyCode == 13) {
        goSite();
        linkio.blur();
    }
}
function clearHolder() {
    linkio.placeholder = '';
    if (temp) {
        linkio.value = temp;
        temp = null;
    }
}


document.getElementById('header_search').addEventListener('click', goSite);
document.getElementById('header_linkio').addEventListener('click', clearHolder);
document.getElementById('header_linkio').addEventListener('keyup', enterPress);