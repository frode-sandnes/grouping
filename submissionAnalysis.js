// Methods for analysing groups of submissions and extracting useful info.
// 1. Groups structures.
// 2. Quick plagiarism indication (not complete)
// 3. Detect assignments submitted to wrong category (swaps).
// 4. Find typicaly keywords for group work.
// 5. Matching versions/revisions.

// utility funciton refactored with useful word list and sets based on the texts.
function extractUsefulSets(texts)
    {
    const few = 9;  // optimised by trial and error        
    let allWords = texts.map(({text}) => textToWords(text));
    let uniqueWords = allWords.map(words => new Set(words));
    let allUniqueWords = allWords.flatMap(set => [...set]);
    let globalWordHistogram = Object.groupBy(allUniqueWords, (word) => word);
    let globalWords = Object.keys(globalWordHistogram);
    let soloWords =  globalWords.filter(word => globalWordHistogram[word].length == 1);
    let soloSet = new Set(soloWords);
    let wordsOfInterest = globalWords.filter(word => globalWordHistogram[word].length > 1 && globalWordHistogram[word].length < few);    
    return {uniqueWords, allUniqueWords, globalWords, soloWords, wordsOfInterest, soloSet};    
    }

// finding group structures from texts
function findGroupsFromTexts(texts)
    {
    let {uniqueWords, soloWords, wordsOfInterest} = extractUsefulSets(texts);       
    const maxGroupSize = 5;
    const maxDropOff = 2;
    // find indices of text with these words
    let wordIndices = wordsOfInterest.map(word => uniqueWords.reduce((accumulator, set, i) => 
        {
        if (set.has(word))
            {
            accumulator.push(i);
            }    
        return accumulator;
        },[]));
    // count all pairs
    let allPairs = [];
    wordIndices.forEach(list => 
        {
        list.forEach((indexA,i) => 
            {
            list.forEach((indexB,j) => 
                {
                if (i < j)
                    {
                    allPairs.push({i:Math.min(indexA,indexB), j:Math.max(indexA,indexB)});
                    }
                });
            });
        });
    // count instances of shared words to find grouping
    let pairHistogram = Object.groupBy(allPairs, ({i,j}) => i+"-"+j);
    pairHistogram = Object.keys(pairHistogram)
                          .map(key => ({...pairHistogram[key][0],f:pairHistogram[key].length}));
    pairHistogram.sort((a, b) => b.f - a.f);                    
    // split into groups based on histogram.
    let grouped = {};   // keep track of which group an element belongs to
    let groups = [];
    pairHistogram.forEach(pair => 
        {
        let {i, j, f} = pair;
        let gid = -1;
        if ((i in grouped) && (j in grouped))
            {
            return;    // do nothing
            }
        if (!(i in grouped) && !(j in grouped)) // new pair
            {
            gid = groups.length;
            groups.push([pair]);
            grouped[i] = gid;   
            grouped[j] = gid;  
            return;    // establishing new group with the pair and return 
            }
        if (!(i in grouped))
            {
            gid = grouped[j];
            grouped[i] = gid;  // appending i to group of j
            }
        else if (!(j in grouped))
            {
            gid = grouped[i];
            grouped[j] = gid;   // appending j to group of i
            }
/* Note: need to resolve what happens if if test below does not trigger - then gid is still assigned - 
   why does this work better?
*/            
        let lastID = groups[gid].length - 1;
        let f2 = groups[gid][lastID].f;
        if (f2 < f * maxDropOff && lastID < maxGroupSize - 1)   // addition criteria
            {
            groups[gid].push(pair); // add the pair
            } 
        });
    // convert groups to stud list for comparison
    let result = texts.map((o,i) => []);
    groups.forEach(group => 
        {
        let groupSet = new Set();       
        group.forEach(({i, j}) => 
            {
            groupSet.add(i);    
            groupSet.add(j);    
            });    
        let groupArray = [...groupSet];
        groupArray.forEach(index => result[index] = groupArray);
        });
    // fill empty rows with the index matching "self"
    result = result.map((group, index) => (group.length > 0? group: [index]));
    // sort in order
    result.forEach(group => group.sort((a, b) => a - b));

    // find keywords for each group
    let wordsOfInterestSet = new Set(wordsOfInterest);
    let keywords = result.map(group => 
        {
        return group.length > 0
            ? group.reduce((accumulator, memberIndex) => accumulator.intersection(uniqueWords[memberIndex]), wordsOfInterestSet)
            : soloWords.intersect(uniqueWords[group[0]]);
        });      
    return {studentMapping:result, groups, keywords};
    }

// for detecting matching versions - return the unique words used in each report.
function findUniqueWords(texts)
    {
    let {uniqueWords, soloSet} = extractUsefulSets(texts);       
    return uniqueWords.map(set => set.intersection(soloSet));
    }

// Santitizing group info from each report - suitable for anonymiztion
function anonymizeTexts(texts, groups)
    {
    // for each student 
    let cleanedTexts = texts.map(({groupStudentNumbers, text}) => 
        {
        // create list of tokens to santize from the student and each group member
        let members = groupStudentNumbers.map(studNo => texts.findIndex(({studentNumber}) => studNo == studentNumber))
                                         .filter(index => index != -1); // only include those found  
        let tokenString = members.map(index => texts[index].formattedName).join(" ")
                        + " "
                        + members.map(index => texts[index].studentNumber.replaceAll("s","")).join(" ");
        let tokenList = tokenString.split(" ");
        // replace tokens if they exist
        let sanitizedText = tokenList.reduce((accumulator, token) => accumulator.replaceAll(token,""), text);
        return sanitizedText;
        });
    // return a copy
    let textCopy = JSON.parse(JSON.stringify(texts));
    textCopy = textCopy.map((o, i) => ({...o, text: cleanedTexts[i]}));
    return textCopy;
    }

function findMostSimilarFromBagOfWords(texts)
    {
    let {wordsOfInterest, uniqueWords} = extractUsefulSets(texts);       
    // find indices of text with these words
    let wordIndices = wordsOfInterest.map(word => uniqueWords.reduce((accumulator, set, i) => 
        {
        if (set.has(word))
            {
            accumulator.push(i);
            }    
        return accumulator;
        },[]));
    // count all pairs
    let allPairs = [];
    wordIndices.forEach(list => 
        {
        list.forEach((indexA,i) => 
            {
            list.forEach((indexB,j) => 
                {
                if (i < j)
                    {
                    allPairs.push({i:Math.min(indexA,indexB), j:Math.max(indexA,indexB)});
                    }
                });
            });
        });
    // count instances of shared words to find grouping
    let pairHistogram = Object.groupBy(allPairs, ({i,j}) => i+"-"+j);
    pairHistogram = Object.keys(pairHistogram)
                          .map(key => ({...pairHistogram[key][0],f:pairHistogram[key].length}));
    pairHistogram.sort((a, b) => b.f - a.f);                    
    // split into most similar pairs based on histogram
    let pairs = texts.map((o,i) => null);
    pairHistogram.forEach(pair => 
        {
        let {i, j, f} = pair;
        if ((pairs[i] !== null) || (pairs[j] !== null))
            {
            return;    // do nothing as at least one element is already paired
            }
        pairs[i] = j;   
        pairs[j] = i;  
        });     
    return pairs;
    }


// instead of just fining one contender, we find N top matches.
function findNMostSimilarFromBagOfWords(texts, N = 5)
    {
    let {wordsOfInterest, uniqueWords} = extractUsefulSets(texts);       
    // find indices of text with these words
    let wordIndices = wordsOfInterest.map(word => uniqueWords.reduce((accumulator, set, i) => 
        {
        if (set.has(word))
            {
            accumulator.push(i);
            }    
        return accumulator;
        },[]));
    // count all pairs
    let allPairs = [];
    wordIndices.forEach(list => 
        {
        list.forEach((indexA,i) => 
            {
            list.forEach((indexB,j) => 
                {
                if (i < j)
                    {
                    allPairs.push({i:Math.min(indexA,indexB), j:Math.max(indexA,indexB)});
                    }
                });
            });
        });
    // count instances of shared words to find grouping
    let pairHistogram = Object.groupBy(allPairs, ({i,j}) => i+"-"+j);
    pairHistogram = Object.keys(pairHistogram)
                          .map(key => ({...pairHistogram[key][0],f:pairHistogram[key].length}));
    pairHistogram.sort((a, b) => b.f - a.f);  
    // split into most similar pairs based on histogram
    let pairs = texts.map(o => []);   // setup 
    pairHistogram.forEach(({i,j}) => 
        {
        if (pairs[i].length < N)
            {
            pairs[i].push(j);    
            }
        if (pairs[j].length < N)
            {
            pairs[j].push(i);    
            }    
        });     
    return pairs;
    }

// check incorrect submission groups - experiment????
function swapAnomalies(a, b, c)
    {
    // prepare project signatures for assignments a, b, c
    let assignments = [a, b, c];
    // accumulate all writings
    let allTexts = assignments.map(assignment =>
        {
        let text = assignment.map(({text}) => text).join(" "); 
        return ({text}); 
        });
    let {uniqueWords, soloSet} = extractUsefulSets(allTexts);       
    // find unique sets for a, b, and c
    let [uniqueWordsA, uniqueWordsB, uniqueWordsC] = uniqueWords; 
    // find unique words per set
    let onlyInA = uniqueWordsA.difference(uniqueWordsB.union(uniqueWordsC));
    let onlyInB = uniqueWordsB.difference(uniqueWordsA.union(uniqueWordsC));
    let onlyInC = uniqueWordsC.difference(uniqueWordsB.union(uniqueWordsA));
    let signatureWords = [onlyInA, onlyInB, onlyInC];
    // remove soloWords also
    signatureWords = signatureWords.map(u => u.difference(soloSet));
    // compute profile for each text
    let profiles = assignments.map(assignment => 
        {
        let allWordsInTexts = assignment.map(({text}) => textToWords(text));
        let uniqueWordsInTexts = allWordsInTexts.map(words => new Set(words));       
        return uniqueWordsInTexts.map(wordSet => signatureWords.map(signature => wordSet.intersection(signature).size));
        });
    // find anomaly
    let anomalies = profiles.map((profile, assignmentNo) => 
        {
        return profile.reduce((accumulator, line, studentIndex) => 
            {
            let max = Math.max(...line);
            let indexMax = line.indexOf(max);
            if (indexMax !== assignmentNo)
                {
                let swapCase = {assignmentNo, studentIndex, detectedAssignment:indexMax};
                accumulator.push(swapCase);
                }
            return accumulator;
            }, []);
        });
    return anomalies;
    }               

// returns the indexes of formativeTexts in relation to all the finalTexts
function findMatchingVersions(formativeTexts, finalTexts)
    {
    // find set of unique words for both version for each student
    let formerWords = findUniqueWords(formativeTexts);
    let finalWords = findUniqueWords(finalTexts);
    // match highest similarity in uniquewords in the two sets.
    return finalWords.map((a,i) => 
        {
        let matches = formerWords.map((b,j) => setSimilarity(a, b)); 
        let max = Math.max(...matches);
        return matches.indexOf(max);
        });    
    }