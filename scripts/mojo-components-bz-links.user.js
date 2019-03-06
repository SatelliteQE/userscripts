// ==UserScript==
// @name        Components BZ links
// @namespace   SatelliteQE
// @description Adds links to Bugzilla search queries with your components
// @match       https://mojo.redhat.com/docs/DOC-1191673
// @version     1.1
// @run-at      document-end
// ==/UserScript==

const categories = [
    {
        'label': 'ON_QA',
        'status': 'ON_QA',
    },
    {
        'label': 'need info from me',
        'status': '__open__',
        'urlpart': '&f1=requestees.login_name&o1=substring&v1=EMAIL_ADDR'
    },
    {
        'label': 'open',
        'status': '__open__',
    },
    {
        'label': 'open, not assigned to me',
        'status': '__open__',
        'urlpart': '&email1=EMAIL_ADDR&emailqa_contact1=1&emailtype1=notsubstring'
    }
];

const columns = ['component', 'assigned_to', 'qa_contact', 'bug_status', 'resolution', 'short_desc', 'changeddate'];

const urlbase = `https://bugzilla.redhat.com/buglist.cgi?query_format=advanced&columnlist=${columns.join(',')}&product=Red Hat Satellite 6`;

const getUserName = function() {
    let avatar = document.querySelector('#j-links img.jive-avatar');
    return avatar.getAttribute('data-username');
};

const getComponentsForUser = function(username) {
    let table = document.querySelector('#jive-body-main table tbody');

    let tableData = Array.from(table.querySelectorAll('tr')).map(tr => {
        let tds = tr.getElementsByTagName('td');
        return {
            'component': tds[0].textContent,
            'primary': tds[1].textContent,
            'secondary': tds[2].textContent,
        };
    });

    let primary = tableData
        .filter(row => row.primary === username)
        .map(row => row.component);

    let secondary = tableData
        .filter(row => row.secondary === username)
        .map(row => row.component);

    return {
        'primary': primary,
        'secondary': secondary,
        'all': primary.concat(secondary)
    };
};

const createUrl = function(user, components, category) {
    let componentsUrlPart = components
        .map(component => `&component=${component}`)
        .join('');

    let href = `${urlbase}&bug_status=${category['status']}${componentsUrlPart}`;

    if (category['urlpart'] !== undefined) {
        href += category['urlpart'];
    }

    return href.replace(/EMAIL_ADDR/g, `${user}@redhat.com`);
};

const main = function() {
    let user = getUserName();
    let components = getComponentsForUser(user);

    let tableContainer = document.querySelector('.jive-rendered-content');

    categories.forEach(category => {
        let row = document.createElement('p');
        row.appendChild(document.createTextNode(`${category.label}:`));

        Object.keys(components).forEach(level => {
            let href = createUrl(user, components[level], category);

            let a = document.createElement('a');
            a.appendChild(document.createTextNode(level));
            a.style.marginLeft = '0.5em';
            a.setAttribute('href', href);

            row.appendChild(a);
        });

        tableContainer.insertBefore(row, tableContainer.lastElementChild);
    });
};

main();
