// ==UserScript==
// @name        Satellite PR review process helper
// @namespace   SatelliteQE
// @description Helps PR review process in SatelliteQE projects
// @match       https://github.com/SatelliteQE/*
// @version     0.1
// @run-at      document-end
// ==/UserScript==

const reviewers = {
    'airgun': {
        'tier1': ['mirzal'],
        'tier2': ['abalakh', 'ldjebran', 'oshtaier']
    },
    'nailgun': {
        'tier1': ['JacobCallahan', 'mirzal', 'omkarkhatavkar', 'rplevka'],
        'tier2': ['abalakh', 'ldjebran', 'jyejare', 'oshtaier', 'san7ket']
    },
    'robottelo': {
        'tier1': ['jhutar', 'jameerpathan111', 'latran', 'mirzal', 'omkarkhatavkar', 'pgagne', 'pondrejk', 'vijay8451'],
        'tier2': ['abalakh', 'ldjebran', 'JacobCallahan', 'jyejare', 'ntkathole', 'oshtaier', 'rplevka']
    },
    'robottelo-ci': {
        'tier1': ['latran'],
        'tier2': ['jyejare', 'san7ket']
    },
    'satellite6-upgrade': {
        'tier1': [],
        'tier2': ['jyejare', 'ntkathole', 'san7ket']
    },
    'testfm': {
        'tier1': ['jameerpathan111'],
        'tier2': ['ntkathole']
    }
}

let url;

const getProjectFromURL = function() {
    let path = window.location.pathname
    return path.split("/")[2];
};

const isPRCommentsPage = function() {
    let currentUrl = window.location.href;
    return currentUrl.includes('pull') && /\d$/.test(currentUrl);
}

const removeIfExists = function(elem) {
    if (elem !== null) {
        elem.parentNode.removeChild(elem);
    }
}

const minimumNumberOfReviewers = function(reviewState) {
    let checkResult = {'passed': undefined, 'message': undefined};
    const reviewNumberThreshold = 2;

    let passedReviews = reviewState.filter(review => review.accepted);

    if (passedReviews.length >= reviewNumberThreshold) {
        checkResult.passed = true;
    } else {
        checkResult.passed = false;
        checkResult.message = `Too few ACKs - ${passedReviews.length} given, ${reviewNumberThreshold} needed`;
    }

    return checkResult;
};

const tier2ReviewerACK = function(reviewState) {
    let checkResult = {'passed': undefined, 'message': undefined};

    let reviewersACK = reviewState.filter(review => review.accepted)
        .filter(review => reviewers[getProjectFromURL()]['tier2'].includes(review.user));

    if (reviewersACK.length >= 1) {
        checkResult.passed = true;
    } else {
        checkResult.passed = false;
        checkResult.message = 'No ACK from Tier2 reviewer';
    }

    return checkResult;
};

const getReviewState = function() {
    if (3 > document.querySelectorAll('#partial-pull-merging .branch-action-item').length) {
        return [];
    }

    const selector = '#partial-pull-merging .branch-action-item:first-of-type .merge-status-list > .merge-status-item';
    return Array.from(document.querySelectorAll(selector))
        .map(reviewElem => {
            let user = reviewElem.querySelector('a[data-hovercard-type="user"]')
                .getAttribute('href')
                .slice(1);
            let rawStatus = reviewElem.querySelector('svg.octicon')
                .classList;

            let accepted = rawStatus.contains('text-green') ? true : false;

            return {'user': user, 'accepted': accepted};
        });
};

const addCustomStyles = function() {
    const styleId = 'SatelliteQE-PR-review';
    if (document.getElementById(styleId) !== null) {
        return;
    }

    const styleRules = [
        '#reviewers {position: absolute; right: -150px;}',
        '#reviewers h4 {margin-top: 1em;}',
        '#satelliteqe-review li {margin-left: 1.2em;}'
    ];

    let style = document.createElement('style');
    style.setAttribute('id', styleId);
    document.head.appendChild(style);
    styleRules.forEach(rule => style.sheet.insertRule(rule));
}

const addReviewersList = function(project) {
    let reviewersBlock = document.getElementById('reviewers');
    removeIfExists(reviewersBlock);

    reviewersList = reviewers[project];

    reviewersBlock = document.createElement('div');
    reviewersBlock.setAttribute('id', 'reviewers');

    Object.keys(reviewersList).forEach(tier => {
        let header = document.createElement('h4');
        header.appendChild(document.createTextNode(tier));
        reviewersBlock.appendChild(header);

        let list = document.createElement('ul');
        reviewersList[tier].forEach(reviewer => {
            let elem = document.createElement('li');
            elem.appendChild(document.createTextNode(reviewer));
            list.appendChild(elem);
        });
        reviewersBlock.appendChild(list);
    });

    document.getElementById('partial-discussion-sidebar').prepend(reviewersBlock);
};

const addProcessStateEvaluation = function() {
    const checks = [minimumNumberOfReviewers, tier2ReviewerACK];
    const reviewState = getReviewState();

    let resultsBlock = document.getElementById('satelliteqe-review');
    removeIfExists(resultsBlock);

    resultsBlock = document.createElement('div');
    resultsBlock.setAttribute('id', 'satelliteqe-review');
    resultsBlock.setAttribute('class', 'branch-action-item js-details-container Details');

    const resultsIconBlock = document.createElement('div');
    resultsIconBlock.setAttribute('class', 'branch-action-item-icon completeness-indicator');
    resultsBlock.appendChild(resultsIconBlock);

    const resultsMessage = document.createElement('h3');
    resultsMessage.setAttribute('class', 'h4 status-heading');
    resultsMessage.appendChild(document.createTextNode('Review process - '));
    resultsBlock.appendChild(resultsMessage);

    const mergeability = document.querySelector('.mergeability-details');
    mergeability.insertBefore(resultsBlock,
        mergeability.getElementsByClassName('branch-action-item')[1]);

    let resultsIconSvgClass, resultsIconSvgInnerD;

    let problems = checks.map(fn => fn(reviewState))
        .filter(result => ! result.passed);

    if (problems.length === 0) {
        resultsMessage.appendChild(document.createTextNode('passed'));
        resultsIconBlock.classList.add('completeness-indicator-success');
        resultsIconSvgClass = 'octicon-check';
        resultsIconSvgInnerD = 'M12 5l-8 8-4-4 1.5-1.5L4 10l6.5-6.5L12 5z';
    } else {
        resultsMessage.appendChild(document.createTextNode('failed'));
        resultsMessage.classList.add('text-red')
        resultsIconBlock.classList.add('completeness-indicator-error');
        resultsIconSvgClass = 'octicon-x';
        resultsIconSvgInnerD = 'M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z';

        const failedChecksList = document.createElement('ul');
        failedChecksList.setAttribute('class', 'status-meta');
        problems.forEach(result => {
            let elem = document.createElement('li');
            elem.appendChild(document.createTextNode(result.message));
            failedChecksList.appendChild(elem);
        });
        resultsBlock.appendChild(failedChecksList);
    }

    resultsIconBlock.innerHTML = `<svg class="octicon ${resultsIconSvgClass}" viewBox="0 0 12 16" version="1.1" width="12" height="16" aria-hidden="true">
        <path fill-rule="evenodd" d="${resultsIconSvgInnerD}"></path></svg>`;
};

const main = function() {
    let project = getProjectFromURL();

    if (! (project in reviewers && isPRCommentsPage())) {
        return;
    }

    addCustomStyles();
    addReviewersList(project);
    addProcessStateEvaluation();
};

let observer = new MutationObserver((changesList, caller) => {
    main();
});

const handleUrlChange = function() {
    let currentUrl = window.location.href;

    if (url === currentUrl) {
        return;
    }

    let pjaxLoader = document.getElementById('js-pjax-loader-bar');
    if (pjaxLoader !== null) {
        observer.observe(pjaxLoader,
            {'attributes': true, 'childList': true, 'subtree': true});
    } else {
        observer.disconnect();
    }

    url = currentUrl;
    main();
};

setInterval(handleUrlChange, 1000);

main();
