"use strict"

// Dice related approximate comparison routines

/////////////// Newly added - test thoroughly.
function sentenceLevelTextSimilarity(texts, sensitivity = 0.5)
    {
    console.log("sentenceLevelTextSimilarity");        
    // preprocessing
    texts.length = 30;   // for debug
    let results = {};   // datastore for matches.
    let textArrayOfSets = texts.map(({text}) => text.split(".").map(text => prepareWordBigramSet(text)));
console.log(textArrayOfSets.length);    
    textArrayOfSets.forEach((aSets, aIndex) => 
        {
        textArrayOfSets.forEach((bSets, bIndex) =>
            {
            if (aIndex < bIndex)
                {
                let matches = sentenceBigramDice(aSets, bSets, sensitivity);
                let similarity = matches / Math.min(aSets.length, bSets.length);
                if (similarity > 0)
                    {
                    if (!(aIndex in results))
                        {
                        results[aIndex] = [];
                        }
                        if (!(bIndex in results))
                        {
                        results[bIndex] = [];
                        }
                    results[aIndex].push({index:bIndex, similarity});
                    results[bIndex].push({index:aIndex, similarity});
//                    console.log({aIndex,bIndex,similarity, matches});
                    }
                }
            })
        });

    // sort the results in decreaing similarity
    textArrayOfSets.forEach((o,i) => {if (i in results) {results[i].sort((a,b) => b.similarity - a.similarity)}});
    // truncate matches to the largest ones
    textArrayOfSets.forEach((o,i) => {if (i in results) {results[i].length = Math.min(results[i].length, 5)}});
    // finished
    console.log(results);
/*    let aSentences = texts[0].text.split(".");
    let bSentences = texts[1].text.split(".");
    let matches = textDice(aSentences, bSentences, 0.5);
    let similarity = matches.length / Math.min(aSentences.length, bSentences.length);
    console.log(matches);
    console.log(aSentences[matches[0].aIndex]);
    console.log(bSentences[matches[0].bIndex]);
    console.log({similarity});  // ratio of sentences with a match   

    let aSets = aSentences.map(text => prepareWordBigramSet(text));
    let bSets = bSentences.map(text => prepareWordBigramSet(text));
*/    
/*    let aSets = textArrayOfSets[0];
    let bSets = textArrayOfSets[1];
console.log(aSets, aSets.length);

    let matches = sentenceBigramDice(aSets, bSets, sensitivity);
    let similarity = matches / Math.min(aSets.length, bSets.length);
    console.log({similarity, matches}, aSets.length, bSets.length);  // ratio of sentences with a match   
 */
   }

function sentenceBigramDice(aSets, bSets, threshold = 0.8)
    {
    // setup preprocessed datastructure for speed            
    let matches = 0;
    aSets.forEach((aSet, aIndex) => 
        {
        let distances = bSets.map((bSet) => wordBigramDice(aSet, bSet));
        let max = distances.reduce((a, b) => Math.max(a, b), -Infinity); // use this one instead in case the list is very large
        let index = distances.indexOf(max); 
        if (max > threshold)
            {
            matches++;      // count the match
            }    
        });   
    return matches;
    }

// Doesn't really belong here but useful still.
function setSimilarity(a, b)
    {
    let a1 = new Set(a);
    let b1 = new Set(b);
    return a1.intersection(b1).size/a1.union(b1).size;
    }

/////////////


// method for API  - takes array for sentences as input.
function textDice(aSentences, bSentences, threshold = 0.8)
    {
    // setup preprocessed datastructure for speed            
    let aSets = aSentences.map(text => prepareWordBigramSet(text));
    let bSets = bSentences.map(text => prepareWordBigramSet(text));
    let matches = [];
    aSets.forEach((aSet, aIndex) => 
        {
        let distances = bSets.map((bSet) => wordBigramDice(aSet, bSet));
        let max = distances.reduce((a, b) => Math.max(a, b), -Infinity); // use this one instead in case the list is very large
        let index = distances.indexOf(max); 
        if (max > threshold)
            {
            matches.push({aIndex, bIndex:index, similarity: max});
            }    
        });   
    return matches;
    }

// experimental based on new set features - check if it is faster
function wordBigramDice(bigramSet1, bigramSet2)
    {
    // early escape for speed
    let minLength = Math.min(bigramSet1.size, bigramSet2.size);
    if (minLength < 3)  // we do not conider 2 bigram -> 3 sentence words are worth comparing.
        {
        return 0;   // do not flag these    
        }
    // find intersecting bigrams
    return bigramSet1.intersection(bigramSet2).size / minLength;
    }
    let keepTextRegExp = /[^\p{Letter}\p{Number}\p{Mark}\s\.\-\[\]\{\}\(\)]+/gu;
    let spaceRegExp = /\s{2,}/g;
    function keepText(text)
        {
        return text.replaceAll(keepTextRegExp, "")
                    .replaceAll(spaceRegExp, " ")
                    .trim();
        }    
    function textToWords(text)
        {
        return keepText(text).toLowerCase().split(" ");
        }    
    
    function prepareWordBigramSet(text)
        {
        return new Set(prepareWordBigram(text));
        }
    // new implementation based on new set features
    function wordDice(text1, text2)
        {
        const bigramSet1 = prepareWordBigramSet(text1);
        const bigramSet2 = prepareWordBigramSet(text2);
        if (bigramSet1.size < 2 || bigramSet2.size < 2) 
            {    
            return 0;
            }
        return 2 * (bigramSet1.intersection(bigramSet2)).size/(bigramSet1.size + bigramSet2.size);
        }    

function prepareWordBigram(text)
    {
    const wordArr = textToWords(text);
    return wordArr.filter((e, i) => i < wordArr.length - 1)
                   .map((e, i) => e + " " + wordArr[i + 1]);	
    }

function textToWords(text)
    {
    return keepText(text).toLowerCase().split(" ");
    }

function originalDice(str1, str2)
    {
    if (str1.length < 2 || str2.length < 2) 
        {
        return 0;
        }
    const charArr1 = [...str1.toLowerCase()], charArr2 = [...str2.toLowerCase()];
    const bigramSet1 = charArr1.filter((e, i) => i < charArr1.length - 1)
                            .reduce((accum, e, i) => accum.add(e + charArr1[i + 1]), new Set());						
    const bigramSet2 = charArr2.filter((e, i) => i < charArr2.length - 1)
                            .reduce((accum, e, i) => accum.add(e + charArr2[i + 1]), new Set());
    return 2*(bigramSet1.intersection(bigramSet2)).size/(bigramSet1.size + bigramSet2.size);      
    }

function findMostSimilarStringInList(str,list)
    {
    let similarities = list.map(str2 => originalDice(str,str2));
    let max = Math.max(...similarities);
    let index = similarities.indexOf(max);
    return list[index];    
    }