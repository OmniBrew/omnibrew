const homepage = require('./homepage')

module.exports = {
    homepage,
    abi_feature: {
        at_level: `When you reach {level}, | When you reach {level}, and again at {and_list} level,`,
        text: `{at_level} you can increase one ability score of your choice 
                by 2, or you can increase two ability scores of your choice by 1.`
    },
    about_title: 'About',
}
