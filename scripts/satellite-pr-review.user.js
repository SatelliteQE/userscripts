// ==UserScript==
// @name        Satellite PR review process helper
// @namespace   SatelliteQE
// @description Helps PR review process in SatelliteQE projects
// @match       https://github.com/SatelliteQE/*
// @version     1.5
// @run-at      document-end
// ==/UserScript==

const reviewers = {
    'airgun': {
        'tier1': ['lhellebr', 'latran', 'omkarkhatavkar', 'schlupov', 'vijay8451'],
        'tier2': ['abalakh', 'ldjebran', 'mirzal', 'oshtaier']
    },
    'nailgun': {
        'tier1': ['JacobCallahan', 'mirzal', 'omkarkhatavkar', 'rplevka', 'lhellebr'],
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

let elementIds = [];

const getProjectFromURL = function() {
    let path = window.location.pathname
    return path.split("/")[2];
};

const isPRCommentsPage = function() {
    let currentUrl = window.location.href;
    return currentUrl.includes('pull') && /\d$/.test(currentUrl);
}

const isNewPRPage = function() {
    let currentUrl = window.location.href;
    return currentUrl.includes('compare/');
}

const isPageLoading = function() {
    let isLoaderWorking = document.querySelector('#js-pjax-loader-bar.is-loading') !== null;
    let isProgressBarFull = document.querySelector('#js-pjax-loader-bar .progress').style.width === '100%';

    return isLoaderWorking || ( ! isProgressBarFull );
};

const customElementsPresent = function() {
    if (elementIds.length === 0) {
        return false;
    }
    return elementIds.every(id => document.getElementById(id) !== null);
}

const removeIfExists = function(elem) {
    if (elem !== null) {
        elem.parentNode.removeChild(elem);
    }
}

const getLabels = function() {
    let labelNodes = document.querySelectorAll('#partial-discussion-sidebar .labels a');
    return Array.from(labelNodes)
        .map(node => node.getAttribute('data-name'));
};

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

// eslint-disable-next-line no-unused-vars
const noDoNotMergeLabel = function(reviewState) {
    let checkResult = {'passed': undefined, 'message': undefined};

    const labels = getLabels();

    checkResult.passed = ! labels.includes('DO NOT MERGE');

    if (! checkResult.passed) {
        checkResult.message = 'DO NOT MERGE label is present';
    }

    return checkResult;
};

const getReviewState = function() {
    if (3 > document.querySelectorAll('#partial-pull-merging .branch-action-item').length) {
        return [];
    }

    const selector = '#partial-pull-merging .branch-action-item:first-of-type .merge-status-list > .merge-status-item';
    return Array.from(document.querySelectorAll(selector))
        .filter(reviewElem => reviewElem.querySelector('a[data-hovercard-type="user"]') !== null)
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
    const elementId = 'satelliteqe-stylesheet';
    elementIds.push(elementId);
    if (document.getElementById(elementId) !== null) {
        return;
    }

    const styleRules = [
        '#satelliteqe-reviewers {position: absolute; right: 300px;}',
        '#satelliteqe-reviewers h4 {margin-top: 1em;}',
        '#satelliteqe-process-checks li {margin-left: 1.2em;}'
    ];

    let style = document.createElement('style');
    style.setAttribute('id', elementId);
    document.head.appendChild(style);
    styleRules.forEach(rule => style.sheet.insertRule(rule));
}

const addReviewersList = function(project) {
    const elementId = 'satelliteqe-reviewers';
    elementIds.push(elementId);

    let reviewersBlock = document.getElementById(elementId);
    removeIfExists(reviewersBlock);

    let reviewersList = reviewers[project];

    reviewersBlock = document.createElement('div');
    reviewersBlock.setAttribute('id', elementId);

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

    let sidebar = document.getElementById('partial-discussion-sidebar') ||
        document.querySelector('.discussion-sidebar');

    sidebar.prepend(reviewersBlock);
};

const addProcessStateEvaluation = function() {
    if (isNewPRPage()) {
        return;
    }

    const checks = [minimumNumberOfReviewers, tier2ReviewerACK, noDoNotMergeLabel];
    const reviewState = getReviewState();

    const elementId = 'satelliteqe-process-checks';
    elementIds.push(elementId);

    let resultsBlock = document.getElementById(elementId);
    removeIfExists(resultsBlock);

    resultsBlock = document.createElement('div');
    resultsBlock.setAttribute('id', elementId);
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

    if (! (project in reviewers)){
        return;
    }

    if (! (isPRCommentsPage() || isNewPRPage())) {
        return;
    }

    addCustomStyles();
    addReviewersList(project);
    addProcessStateEvaluation();
};

const checkIfRunRequired = function() {
    if (isPageLoading() || customElementsPresent()) {
        return;
    }

    main();
};

setInterval(checkIfRunRequired, 1000);

main();
