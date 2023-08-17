/*****************************************************
 * 
 * 
 *      Main...
 * 
 * 
 ****************************************************/

const {toCapitalize, getValidatedPropValues, zipData, getAllObjectKeys, toNormalString, queryStringToObject, moderator, slowDown} = window.ccUtilities;


let apiUrl = "https://api.scryfall.com",
    selectedLanguage = null,
    selectedGame = null;

function getCardBasicProps(cardObject, frameEffects)   {
    // let { name : productName, image_uris, mana_cost : cost, colors, type_line : cardType, power, toughness, artist, oracle_text, flavor_text } = cardObject;

    let productName = function(){
            let name = selectedLanguage ? getValidatedPropValues(cardObject, ["printed_name"]) : getValidatedPropValues(cardObject, ["name"]);

            return [name, frameEffects].filter(item => item !== null || item !== "").join("");
        }(),
        name = selectedLanguage ? getValidatedPropValues(cardObject, ["printed_name"]) : getValidatedPropValues(cardObject, ["name"]),
        imageUris = function(){
            let imageUris = getValidatedPropValues(cardObject, ["image_uris"]);

            if(!imageUris)  {
                return [];
            }

            for(let key in imageUris)   {
                let [image] = imageUris[key].split("?");

                imageUris[key] = image;
            }
            
            return imageUris.large ? [imageUris.large] : imageUris.normal ? [imageUris.normal] : imageUris.small ? [imageUris.small] : [];
        }(),
        cost = function(){
            let manaCost = getValidatedPropValues(cardObject, ["mana_cost"]);
            return manaCost ? manaCost.replace(/{/g, "").replace(/}/g, "").trim().toUpperCase() : null;
        }(),
        color = function(){
            let colorsObject = {
                    "W" : "White",
                    "U" : "Blue",
                    "B" : "Black",
                    "R" : "Red",
                    "G" : "Green",
                    "L" : "Basic Land",
                },
                colorArr = getValidatedPropValues(cardObject, ["colors"]);
            if(!colorArr || !colorArr.length)   {
                return "Colorless";
            }

            if(colorArr.length > 1) {
                return "Multi-Color";
            } else {
                let [colorKey] = colorArr;

                return colorsObject[colorKey];
            }

        }(),
        cardType = selectedLanguage ? getValidatedPropValues(cardObject, ["printed_type_line"]) : getValidatedPropValues(cardObject, ["type_line"]),
        powTgh = function(){
            let power = getValidatedPropValues(cardObject, ["power"]) || "*",
                toughness = getValidatedPropValues(cardObject, ["toughness"]) || "*",
                powTghArr = [power, toughness];
            return !powTghArr.every(item => item === "*") ? powTghArr.join("/") : "";
        }(),
        cardText = function(){
            let oracle_text = getValidatedPropValues(cardObject, ["printed_text"]),
                flavor_text = getValidatedPropValues(cardObject, ["flavor_text"]);
                
                
                return [oracle_text, flavor_text].filter(item => item !== null && item !== "").map(item => item.replace(/\n+/g, " <br />")).join(" <br />")
        }(),
        
        
        artist = getValidatedPropValues(cardObject, ["artist"]);
    
    return {
        productName,
        name,
        imageUris,
        cost,
        color, 
        cardType,
        powTgh,
        cardText,
        artist,
    }
}

function getCardDetails(productObject)    {

    let {card_faces, rarity, collector_number : cardNumber, finishes, set_name : setName, frameEffects} = productObject,
        finish = function(){
            return finishes.includes("foil") ? "Foil" : "Regular";
        }();


    if(card_faces)  {
        cardObjects = card_faces.map(cardObject => getCardBasicProps(cardObject, frameEffects));

        return {
            ["Product Name"] : cardObjects.map(item => item.productName).join(" // "),
            ["Card Number"] : cardNumber,
            imageUris : cardObjects.map(item => item.imageUris).reduce((a, b) => {
                a.push(...b);
                return a;
            }, []),
            ["Artist"] : cardObjects.map(item => item.artist).join(" // "),
            ["Card Text"] : cardObjects.map(item => item.cardText).join(" // "),
            ["Card Type"] : cardObjects.map(item => item.cardType).filter(item => item !== "").join(" // "),
            ["Color"] : cardObjects.map(item => item.color).filter(item => item !== "").join(" // "),
            ["Cost"] : cardObjects.map(item => item.cost).filter(item => item !== "").join(" // "),
            ["Pow/Tgh"] : cardObjects.map(item => item.powTgh).filter(item => item !== "").join(" // "),
            ["Rarity"] : toCapitalize(rarity),
            ["Finish"] : finish,
            ["Name"] : cardObjects.map(item => item.name).join(" // "),
            ["Set Name"] : setName,
            ["Game"] : "Magic: The Gathering",
        }

    } else  {

        
        let {
                productName,
                name,
                imageUris,
                cost,
                color, 
                cardType,
                powTgh,
                cardText,
                artist
            } = getCardBasicProps(productObject, frameEffects);
        
        return {
            ["Product Name"] : productName,
            ["Card Number"] : cardNumber,
            imageUris,
            ["Artist"] : artist,
            ["Card Text"] : cardText,
            ["Card Type"] : cardType,
            ["Color"] : color,
            ["Cost"] : cost,
            ["Pow/Tgh"] : powTgh,
            ["Rarity"] : toCapitalize(rarity),
            ["Finish"] : finish,
            ["Name"] : name,
            ["Set Name"] : setName,
            ["Game"] : "Magic: The Gathering",
        }
    }

    

}


async function getAllProductsFromApi(apiUrl)    {

    if(!apiUrl) {
        return [];
    }

    let allProductObjects = [];
    
    async function getProductsByApi(apiUrl)  {
        let res = await fetch(apiUrl),
            data = await res.json(),
            {next_page, data : productObjects} = data;
    
        allProductObjects.push(...productObjects);

        if(next_page)   {
            await getProductsByApi(next_page);
        }
    }

    await getProductsByApi(apiUrl);

    return allProductObjects;

}

async function getSetByUrl(url)   {
    let setApiUrl = `${apiUrl}/sets`,
        res = await fetch(setApiUrl),
        data = await res.json(),
        foundSet = null;

    if(!data.data || !Array.isArray(data.data))   {

        return {
            message : "we couldn't find the set that you look for.",
            statusOk : false,
        }
    }

    let {
        urlWithoutQueryString,
        queryObject,
    } = queryStringToObject(url);

    if(Object.keys(queryObject).length) {
        foundSet = data.data.find(item => `${item.scryfall_uri}/` === urlWithoutQueryString);

        if(queryObject.lang)    {
            selectedLanguage = queryObject.lang;
        }

    } else  {
        foundSet = data.data.find(item => item.scryfall_uri === url);
    }

    

    console.log({foundSet, url, selectedLanguage});
    
    return foundSet;
    
}



/*****************************************************
 * 
 * 
 *      Initialization...
 * 
 * 
 ****************************************************/


async function downloadZip(foundSet, productObjects, callback)    {

    let downloadButtonContainer = document.querySelector(".download-button-container"),
        messageContainer = document.querySelector(".download-message-container"),
        content = `<div class="preloader-wrapper small active">
            <div class="spinner-layer spinner-green-only">
            <div class="circle-clipper left">
                <div class="circle"></div>
            </div><div class="gap-patch">
                <div class="circle"></div>
            </div><div class="circle-clipper right">
                <div class="circle"></div>
            </div>
            </div>
        </div>`;


    if(!messageContainer)   {
        messageContainer = document.createElement("div");
        messageContainer.classList.add("download-message-container");
        downloadButtonContainer.append(messageContainer);
    }

    
    messageContainer.innerHTML = content;


    await zipData({setData : { setName : foundSet.name}, productObjects, imageNameObject : {
        shared : ["Card Number"],
        split : ["Product Name"]
    }, imagePropName : 'productImage', csvExcludedProps : [], includeJson : true,}, callback)
}

async function getAllProductObjectsByLang(productObjects, setCode) {
    let localizedProductObjects = [],
        apiUrl = `https://api.scryfall.com/cards`;



    // get the set code

    // get the collector_number

    await moderator(productObjects, async (slicedArr) => {

        await slowDown(3434);

        let promises = slicedArr.map(productObject => {
            return async function() {
                try {
                    let {collector_number, set} = productObject,
                        res = await fetch(`${apiUrl}/${set}/${collector_number}/${selectedLanguage}`);

                    if(!res.ok) {
                        throw Error(`Card not found. Status : ${res.status}`);
                    }

                    let localizedProductObject = await res.json();


                    console.log(localizedProductObject);
                
                    localizedProductObjects.push(localizedProductObject);
                } catch(err)    {
                    console.log(err.message);
                }
                

                
            }
        });

        await Promise.all(promises.map(item => item()));

        

    }, 25);

    await slowDown(3434);

    console.table(localizedProductObjects);

    return localizedProductObjects;
}

async function scrapeData(url)    {
    let foundSet = await getSetByUrl(url),
        productObjects = [];

    if(foundSet)    {
        productObjects = await getAllProductsFromApi(foundSet.search_uri);
    }

    if(selectedLanguage)    {
        productObjects = await getAllProductObjectsByLang(productObjects);
    }


    productObjects = productObjects.map(item => getCardDetails(item));

    return {productObjects, foundSet};
}

function createTable({className, dataArr, excludedKeys = []}) {

    let columns = getAllObjectKeys(dataArr).filter(item => !excludedKeys.includes(item)),
        thead = function()  {
            return `<thead><tr>${columns.map(item => `<th>${toNormalString(item)}</th>`).join("")}</tr></thead>`;
        },
        tbody = function()  {
            return dataArr.map(row => {
                
                return `<tr>${columns.map(col => {
                    let content = null;
                    if(col === "imageUris") {
                        let imageUris = row[col];

                        content = "<div>";
                        if(Array.isArray(imageUris))    {
                            content += imageUris.map(item => {
                                return `<image src="${item}" />`;
                            }).join("");
                        }
                        content += "</div>";
                        
                    } else  {
                        content = row[col] ? row[col] : "";
                    }
                    return `<td>${content}</td>`;
                }).join("")}</tr>`

            }).join("");
            
        };

    return `
    <div class="table-wrapper" style="width:100%; overflow: auto">
        <table class="${className}" style="width: auto;">
            ${thead()}
            <tbody>
                ${tbody()}
                <!-- and so on... -->
            </tbody>
        </table>
    <div>
    `;
}

function showDownloadZipButton(foundSet, productObjects, callback)    {
    let button = document.createElement("a"),
        downloadButtonContainer = document.querySelector(".download-button-container");

    button.classList.add("waves-effect", "waves-light", "btn", "download-button");
    button.innerHTML = `Download the Zipped File<i class="material-icons right">file_download</i>`;

    downloadButtonContainer.append(button);

    button.addEventListener("click", async (e) => {
        e.preventDefault();
        e.target.classList.add("disabled");

        await downloadZip(foundSet, productObjects, callback)
    })
}

function showMessage(data)  {
    let downloadButtonContainer = document.querySelector(".download-button-container"),
        messageContainer = document.querySelector(".download-message-container"),
        downloadButton = document.querySelector(".download-button"),
        content = null;

    if(!messageContainer)   {
        messageContainer = document.createElement("div");
        messageContainer.classList.add("download-message-container");
        downloadButtonContainer.append(messageContainer);
    }


    content = "<p class=code>Downloading the zipped file...</p>";
    content += `<ul class="code">`;
    console.log(data);
    if(typeof data === "object")    {
        content += Object.keys(data).map(key => {
            return `<li>${key} : ${data[key]}</li>`;
        }).join("");
    } else  {
        content += `<li>${data}</li>`;
    }
    content += `<ul>`;


    messageContainer.innerHTML = content;

    if(data === "zipping done, please wait for the file to appear") {
        setTimeout(() => {
            messageContainer.innerHTML = "";

            messageContainer.remove();

            downloadButton.classList.remove("disabled");
        }, 500);
    }


}

function showErrorMessage(message)  {
    let errorMessageContainer = document.querySelector(".error-message-container"),
        content = `<p clas="code-error">${message}</p>`;

    errorMessageContainer.innerHTML = content;

    setTimeout(() => {
        errorMessageContainer.innerHTML = "";
    }, 3000);
}

function removeDownloadButton() {
    let downloadButton = document.querySelector(".download-button");
    if(downloadButton)  {
        downloadButton.remove();
    }
}

(async function(){

    let aButton = document.querySelector(".get-products-set"),
        textInput = document.querySelector(".url-input"),
        tableContainer = document.querySelector(".table-container"),
        foundSet = null;
        productObjects = null;

    aButton.addEventListener("click", async (e) => {
        e.preventDefault();

        e.target.classList.add("disabled");
        textInput.setAttribute("disabled", "");

        let url = textInput.value;

        try {

            if(foundSet && foundSet.scryfall_uri === url)   {

                showErrorMessage("We already have the same data shown on the table below.")
                e.target.classList.remove("disabled");
                textInput.removeAttribute("disabled", "");
                return;
            }

            removeDownloadButton();

            let dataObj = await scrapeData(url);

            foundSet = dataObj.foundSet;
            productObjects = dataObj.productObjects;




            e.target.classList.remove("disabled");
            textInput.removeAttribute("disabled", "");


            let table = createTable({className : "styled-table", dataArr : productObjects, excludedKeys : []});

            tableContainer.innerHTML = table;


            showDownloadZipButton(foundSet, productObjects, showMessage);

            window.productObjects = productObjects;
            window.foundSet = foundSet;
        } catch(err)    {
            console.log(err.message);

            e.target.classList.remove("disabled");
            textInput.removeAttribute("disabled", "");
        }

    })

    

    // console.log(productObjects);

    

}())

