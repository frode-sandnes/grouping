"use strict"

// need to run as live server for this to work. Later make fileloader.
// load all
const testNames = [
        './hci1-2023-processed.json',
        './hci2-2023-processed.json',
        './hci3-2023-processed.json',
        './MMI-proj1-2024-final.json',
        './MMI-proj2-2024-final.json',
        './MMI-proj3-2024-final.json'
        ];

 Promise.all(testNames.map(test => fetch(test)))
        .then(responses => Promise.all(responses.map(response => response.json())))
        .then(responses => experiment(responses));

// utilitity function for experiment and testing
function findGroupGroundTruth(formativeTexts)
    {
    // make set of actual submissions
    let allStudents = new Set(formativeTexts.map(({name}) => name));
    let groups = formativeTexts.reduce((accumulator,{name,groupStudentNumbers},index) => 
        {
        let members = groupStudentNumbers.map(studNo => formativeTexts.findIndex(({studentNumber}) => studNo == studentNumber))
                                         .filter(index => index != -1); // only include those found
        members.sort((a, b) => a - b);
        return ({...accumulator, [index]:members});
        },{});
    return groups;
    }

function performanceMeasures(estimated, groundTruth)
    {
    let estimate = new Set(estimated);
    let truth = new Set(groundTruth);
    let truePositives = estimate.intersection(truth);
    let falsePositives = estimate.difference(truth);
    let allRetrieved = estimate.union(truth); 
    let similarity = truePositives.size / allRetrieved.size; // same as precision
    let precision = truePositives.size / (truePositives.size + falsePositives.size);
    let recall = truePositives.size / truth.size;
    let F = ((precision + recall) > 0) 
        ? 2 * (precision * recall) / (precision + recall)
        : 0;
    let success = similarity < 1 ? 0: 1;
    return {success, similarity, precision, recall, F};
    }

function mean(list, attribute)
    {
    return list.reduce((accumulator, {[attribute]:element}) => accumulator + element, 0) / list.length;
    }

function uniqueGroupKeywordStats(name, json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts;         
    // experiment 
    let {keywords} = findGroupsFromTexts(texts);
    // output 
    let observations = keywords.map(({size}) => ({size}));
    return {    // return and opening brace must be on the same line
        N: observations.length,
        meanKeywordCount: mean(observations,"size"),
        minKeywordCount: Math.min(...observations.map(({size})=>size)),
        maxKeywordCount: Math.max(...observations.map(({size})=>size))
        };
    }

function matchingVersionStats(name, json)
    {
    let {formativeTexts, finalTexts} = json;
    let commonIds = (new Set(formativeTexts.map(({formattedName}) => formattedName))).intersection(
                     new Set(finalTexts.map(({formattedName}) => formattedName)));
    // match highest similarity in uniquewords in the two sets.
    let matches = findMatchingVersions(formativeTexts, finalTexts);
    let observations = [];
    matches.forEach((j,i) => 
        {   
        let id1 = finalTexts[i].formattedName;
        let id2 = "";
        if (j == -1)
            {
//            console.log(id1 + " no match.");
            }
        else    
            {
            id2 = formativeTexts[j].formattedName;
            }
        // only do stats of we have both pairs
        if (commonIds.has(id1) && commonIds.has(id2))
            {
            observations.push({success: id1 == id2});
            }
        });

    return {name, 
        formativeN:formativeTexts.length,
        finalN:finalTexts.length,
        bothN:commonIds.size,
        success: mean(observations, "success")
        };     
    }


function groupStats(name,json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts; 
    // extract relevant part of resulting object
    let groundTruths = findGroupGroundTruth(texts);
    let anonymizedTexts = anonymizeTexts(texts, groundTruths);
    // experiment 
    let {studentMapping, groups, keywords} = findGroupsFromTexts(texts);
    // output comparison
    let measures = [];
    studentMapping.forEach((estimate, i) => 
        {
        let observation = performanceMeasures(estimate, groundTruths[i]);
        measures.push(observation);
        });
     //  comparison with anonymized data
    ({studentMapping, groups, keywords} = findGroupsFromTexts(anonymizedTexts));
    let measuresAnonymized = [];
    studentMapping.forEach((estimate, i) => 
        {
        let observation = performanceMeasures(estimate, groundTruths[i]);
        measuresAnonymized.push(observation);
        });

    return {name, 
        N:texts.length,
        groups:groups.length,
        success: mean(measures, "success"),
        successAnonymized: mean(measuresAnonymized, "success"),
        similarity: mean(measures, "similarity"),
        similarityAnonymized: mean(measuresAnonymized, "similarity"),
        precision: mean(measures, "precision"),
        precisionAnonymized: mean(measuresAnonymized, "precision"),
        recall: mean(measures, "recall"),
        recallAnonymized: mean(measuresAnonymized, "recall"),
        F: mean(measures, "F"),
        FAnonymized: mean(measuresAnonymized, "F")
        };     
    }

function saveSheet(filename, sheet)
    {
	var ws = XLSX.utils.json_to_sheet(sheet);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, filename);
    XLSX.writeFile(wb, filename);
    }

function mostSimilarStats(name, json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts; 
    // extract relevant part of resulting object
    let groundTruths = findMostSimilarGroundTruth(texts);
    // experiment 
    let mostSimilar = findMostSimilarFromBagOfWords(texts);
    // output comparison
    let measures = [];
    mostSimilar.forEach((j, i) => 
        {
        let success = j == groundTruths[i] ? 1:0;
        let undetected = j == null ? 1: 0;
        let successPst = success == 1 ? texts[i].mostSimilarTo.similarity : 0;
        let failPst = success == 0 ? texts[i].mostSimilarTo.similarity : 0;
        let similarity = undetected == 1 ? 0: wordDice(texts[i].text, texts[j].text);
        let trueSimilarity = undetected == 0 ? texts[i].mostSimilarTo.similarity : 0;
        let observation = {success, undetected, successPst, failPst, similarity, trueSimilarity};
        measures.push(observation);
        });    
    return {name, 
            N:texts.length,
            success: mean(measures, "success"),
            undetected: mean(measures, "undetected"),
            meanSimilarityOnSuccess: mean(measures, "successPst"),
            meanSimilarityOnFail: mean(measures, "failPst"),
            maxSimilarityOnSuccess: Math.max(...measures.map(({successPst}) => successPst)),
            maxSimilarityOnFail: Math.max(...measures.map(({failPst}) => failPst)),
            meanSimilarity: mean(measures,"similarity"),
            meanTrueSimilarity: mean(measures,"trueSimilarity")
            };
    }
    

// using groups instead and see if the max is within the detected group
// not super effective
function mostSimilar2Stats(name, json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts; 
    // extract relevant part of resulting object
    let groundTruths = findMostSimilarGroundTruth(texts);
    // experiment 
    let {studentMapping} = findGroupsFromTexts(texts);
    // output comparison
    let measures = [];
    studentMapping.forEach((list, i) => 
        {
        let success = list.includes(groundTruths[i]) ? 1:0;
        let undetected = list.length == 1 ? 1: 0;
        let successPst = success == 1 
                ? texts[i].mostSimilarTo.similarity
                : 0;
        let failPst = success == 1 
                ? 0
                : texts[i].mostSimilarTo.similarity;
        let similarity = undetected == 1 ? 0: Math.max(...list.filter(k => k !== i).map(k => wordDice(texts[i].text, texts[k].text)));
        let trueSimilarity = undetected == 0 ? texts[i].mostSimilarTo.similarity : 0;
        let observation = {success, undetected, successPst, failPst, similarity, trueSimilarity };
        measures.push(observation);
        });
    return {name, 
            N:texts.length,
            success: mean(measures, "success"),
            undetected: mean(measures, "undetected"),
            meanTrueSimilarityOnSuccess: mean(measures, "successPst"),
            meanTrueSimilarityOnFail: mean(measures, "failPst"),
            maxTrueSimilarityOnSuccess: Math.max(...measures.map(({successPst}) => successPst)),
            maxTrueSimilarityOnFail: Math.max(...measures.map(({failPst}) => failPst)),
            meanSimilarity: mean(measures,"similarity"),
            meanTrueSimilarity: mean(measures,"trueSimilarity")
            };
    }


// top N individual matches instead of grup
function mostSimilar3Stats(name, json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts; 
    // extract relevant part of resulting object
    let groundTruths = findMostSimilarGroundTruth(texts);
    // experiment 
    let studentMapping = findNMostSimilarFromBagOfWords(texts, 5);
    // output comparison
    let measures = [];
//console.log(studentMapping)    
    studentMapping.forEach((list, i) => 
        {
        let success = list.includes(groundTruths[i]) ? 1:0;
        let undetected = list.length < 1 ? 1: 0;
        let successPst = success == 1 
                ? texts[i].mostSimilarTo.similarity
                : 0;
        let failPst = success == 1 
                ? 0
                : texts[i].mostSimilarTo.similarity;
        let similarity = undetected == 1 ? 0: Math.max(...list.filter(k => k !== i).map(k => wordDice(texts[i].text, texts[k].text)));
        let trueSimilarity = undetected == 0 ? texts[i].mostSimilarTo.similarity : 0;
        let observation = {success, undetected, successPst, failPst, similarity, trueSimilarity };
        measures.push(observation);
        });
    return {name, 
            N:texts.length,
            success: mean(measures, "success"),
            undetected: mean(measures, "undetected"),
            meanTrueSimilarityOnSuccess: mean(measures, "successPst"),
            meanTrueSimilarityOnFail: mean(measures, "failPst"),
            maxTrueSimilarityOnSuccess: Math.max(...measures.map(({successPst}) => successPst)),
            maxTrueSimilarityOnFail: Math.max(...measures.map(({failPst}) => failPst)),
            meanSimilarity: mean(measures,"similarity"),
            meanTrueSimilarity: mean(measures,"trueSimilarity")
            };
    }


function findMostSimilarGroundTruth(texts)
    {
    return texts.map(text =>
        {
        let mostSimilar = text.mostSimilarTo.name;
        let index = texts.findIndex(({formattedName}) => originalDice(formattedName, mostSimilar) > 0.7);
        return index;
        });
    }

function swapStats(name, aSource, bSource, cSource, final)
    {
    name = name + (final? "-final": "-former");
    let a = final? aSource.finalTexts: aSource.formativeTexts;   
    let b = final? bSource.finalTexts: bSource.formativeTexts;   
    let c = final? cSource.finalTexts: cSource.formativeTexts;  
    
    let anomalies = swapAnomalies(a, b, c);

    return anomalies.reduce((accumulator, list, i) => ({...accumulator, ["AnomaliesAssignment"+i]:list.length}),{name});
    }

// remove entries that have less than 3 pages and return summary of submissionss
function cleanDataset(name, json, final)
    {
    name = name + (final? "-final": "-former");
    let texts = final? json.finalTexts: json.formativeTexts; 
    let N = texts.length;  
    texts = texts.filter(({noPages}) => noPages > 2);
    if (final)
        {
        json.finalTexts = texts;
        }
    else
        {
        json.formativeTexts = texts;
        }
    let adjustedN = texts.length;
    let meanPages = mean(texts.map(({noPages}) => ({noPages})), "noPages");       
    let meanWords = mean(texts.map(({noWords}) => ({noWords})), "noWords");       
    return {name, N, adjustedN, meanPages, meanWords};
    }

// for experiment - called when all json files are loaded
function experiment(jsonArray)
    {
    console.time();
    console.log("Starting experiment");
    const final = true;
    const former = false;
    let groupIndexes = [1,2,4,5];
    let groupCases = jsonArray.filter((o,i) => groupIndexes.includes(i)); 
    let groupNames = testNames.filter((o,i) => groupIndexes.includes(i)); 

    // cleaning up the dataset and collect info
    console.log("cleaning the data...");    
    let info = [...testNames.map((name, i) => cleanDataset(name,jsonArray[i], former)),
                ...testNames.map((name, i) => cleanDataset(name,jsonArray[i], final))];
    saveSheet("dataset.xlsx", info);
    console.timeEnd()
    console.time();
/*
    // run group identification tests
    console.log("group identification tests...");   
    let groups = [...groupNames.map((name, i) => groupStats(name,groupCases[i], former)),
                  ...groupNames.map((name, i) => groupStats(name,groupCases[i], final))];
    saveSheet("groups.xlsx", groups);
    console.timeEnd()
    console.time();    

    // run plagiarisms test
    console.log("mostSimilar tests...");    
    let mostSimilar = [...testNames.map((name, i) => mostSimilarStats(name,jsonArray[i], former)),
                       ...testNames.map((name, i) => mostSimilarStats(name,jsonArray[i], final))];
    saveSheet("similarTo.xlsx", mostSimilar);
    console.timeEnd()
    console.time();

    // run 2nd plagiarisms test based on groups
    console.log("mostSimilar tests...");    
    let mostSimilar2 = [...testNames.map((name, i) => mostSimilar2Stats(name,jsonArray[i], former)),
                        ...testNames.map((name, i) => mostSimilar2Stats(name,jsonArray[i], final))];
    saveSheet("similarTo2.xlsx", mostSimilar2);
    console.timeEnd()
    console.time();

*/
    // run 3rd plagiarism test based on N-individual tests
    console.log("mostSimilar 3 tests...");    
    let mostSimilar3 = [...testNames.map((name, i) => mostSimilar3Stats(name,jsonArray[i], former)),
                   ...testNames.map((name, i) => mostSimilar3Stats(name,jsonArray[i], final))];
    saveSheet("similarTo3.xlsx", mostSimilar3);
    console.timeEnd()
    console.time();

/*
    // run version matching tests
    console.log("versionMatching tests...");    
    let versionMatching = testNames.map((name, i) => matchingVersionStats(name,jsonArray[i]));
    saveSheet("versionMatching.xlsx", versionMatching);
    console.timeEnd()
    console.time();

    // run unique group keyword stats
    console.log("group unique keyword tests...");   
    groups = [...groupNames.map((name, i) => uniqueGroupKeywordStats(name,groupCases[i], former)),
                  ...groupNames.map((name, i) => uniqueGroupKeywordStats(name,groupCases[i], final))];
    saveSheet("groupKeywords.xlsx", groups);  
    console.timeEnd(); 
    console.time();
     
    // run submission swap check
    console.log(" submission swap check tests...");   
    let swaps = [swapStats(testNames[0],jsonArray[0], jsonArray[1], jsonArray[2], former),
                 swapStats(testNames[0],jsonArray[0], jsonArray[1], jsonArray[2], final),
                 swapStats(testNames[3],jsonArray[3], jsonArray[4], jsonArray[5], former),
                 swapStats(testNames[3],jsonArray[3], jsonArray[4], jsonArray[5], final)];
    saveSheet("groupSwaps.xlsx", swaps);
*/
    console.log("Finished experiment");
    console.timeEnd();
    }