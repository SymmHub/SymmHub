
const TMB_WIDTH = 100;
const TMB_HEIGHT = 100;
const IMG_MARGIN = 10;
const PX = 'px';
const IMG_BACKGROUND_COLOR = '#EEE';
const IMG_BACKGROUND_COLOR_HOVER = '#FFA';
const IMG_BORDER_COLOR_SELECTED = '#22F';
const IMG_BORDER_COLOR_UNSELECTED = IMG_BACKGROUND_COLOR;

function createImageButton(options){
    
    let mImage = document.createElement('img');
    mImage.src = options.src;
    let mWidth = options.width || TMB_WIDTH;
    let mHeight = options.height || TMB_HEIGHT;
    let onClick = options.onClick || onClickDefault;
    let mUserData = options.userData || {};
    setDefaultStyle(mImage);
    let mHover = false;
    let mPressed = false;
    let mSelected = false;
    
    
    let myself = {
        img: mImage,
        userData: mUserData,        
        setSelected: setSelected,
    };

    mImage.onmousedown = function() {
        mPressed = true;
        updateStyle(mImage);
    };

    mImage.onmouseup = function(evt) {
        
        if (mPressed) {
            mPressed = false;
            onClick(myself);
        }
        mImage.blur();
        updateStyle(mImage);
    };

    mImage.onmouseenter = function() {
        mHover = true;
        updateStyle(mImage);
    };

    mImage.onmouseleave = function() {
        mHover = false;
        mImage.onmouseup();
    };

    function setSelected(value){
        mSelected = value;
        updateStyle(mImage);
    }

    function onClickDefault(evt){
            console.log('onClickDefault()', evt);
    }
    
    function updateStyle(img){
        if(mHover){
            img.style.backgroundColor = IMG_BACKGROUND_COLOR_HOVER;            
            //img.style.borderStyle = 'solid';
            //img.style.borderColor = IMG_BORDER_COLOR_SELECTED;

        } else {
            img.style.backgroundColor = IMG_BACKGROUND_COLOR;                        
        }  
        if(mSelected){
           img.style.borderColor = IMG_BORDER_COLOR_SELECTED;
           img.style.borderStyle = 'solid';
        }  else {
           img.style.borderColor = IMG_BORDER_COLOR_UNSELECTED;            
           img.style.borderStyle = 'none';
        }            
    }

    function setDefaultStyle(img){
        
        let style = img.style;
        style.width = mWidth + PX;
        style.height = mHeight + PX;
        style.backgroundColor = IMG_BACKGROUND_COLOR;
        style.marginLeft = IMG_MARGIN + PX;
        style.marginTop = IMG_MARGIN;
        style.marginBottom = '0px';
        style.marginRight = '0px';
        style.borderWidth = '4px';
        style.borderStyle = 'none';
        style.bolderColor = IMG_BORDER_COLOR_UNSELECTED;

    }


    return myself;
    
    
}




export {
    createImageButton
};