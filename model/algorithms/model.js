const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');


// Function to load CSV data
function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv({ headers: true })) // Assuming CSV has headers
            .on('data', (data) => {
                // Convert all values to floats, except the label
                const row = Object.values(data).map((value, index) => 
                    index !== 2 ? parseFloat(value) : parseInt(value));
                results.push(row);
            })
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

// Function to split features and labels
function splitFeaturesAndLabels(data) {
    const features = data.map(row => row.filter((_, index) => index !== 2)); // Exclude the label
    const labels = data.map(row => row[2]); // Only the label
    return { features, labels };
}

// Function to split data into training and testing sets
function splitData(data, testRatio) {
    const shuffled = data.sort(() => 0.5 - Math.random());
    const testSize = Math.floor(data.length * testRatio);
    const testData = shuffled.slice(0, testSize);
    const trainData = shuffled.slice(testSize);
    return { trainData, testData };
}

// Function to create the logistic regression model
function createModel(inputShape) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ 
        units: 1, 
        activation: 'sigmoid', 
        inputShape: [inputShape],
        kernelRegularizer: tf.regularizers.l2({ l2: 1000 }) // L2 regularization; adjust value as needed
    }));

    // Create a custom Adam optimizer with a specific learning rate
    const customAdam = tf.train.adam(0.001); // Adjust learning rate to match the effect of C in LogisticRegression

    model.compile({ 
        optimizer: customAdam, 
        loss: 'binaryCrossentropy', 
        metrics: ['accuracy'] 
    });

    return model;
}


async function trainModel(model, X_train, y_train) {
    const xs = tf.tensor2d(X_train);
    const labels = tf.tensor1d(y_train, 'int32');

    await model.fit(xs, labels, {
        epochs: 120,
        verbose: 1
    });

    console.log("Model trained successfully");
}

async function evaluateModel(model, X_test, y_test) {
    const testXs = tf.tensor2d(X_test);
    const testYs = tf.tensor1d(y_test, 'int32');

    const evalResult = model.evaluate(testXs, testYs);
    const testAcc = await evalResult[1].dataSync()[0];
    console.log(`Test accuracy: ${testAcc}`);
}

async function main() {
    const dataPath = path.join(__dirname, '../data/extracted_data/output.csv');
    const rawData = await loadCSV(dataPath);
    const { features, labels } = splitFeaturesAndLabels(rawData);
    const { trainData, testData } = splitData(features.map((feature, index) => [...feature, labels[index]]), 0.2);

    const X_train = trainData.map(row => row.slice(0, -1));
    const y_train = trainData.map(row => row[row.length - 1]);
    const X_test = testData.map(row => row.slice(0, -1));
    const y_test = testData.map(row => row[row.length - 1]);

    // Create and train the model
    const model = createModel(X_train[0].length);
    await trainModel(model, X_train, y_train);

    // Evaluate the model
    await evaluateModel(model, X_test, y_test);

    // Save the model
    await model.save('file:///Users/sonyashijin/three-js-games/piano_mesh/src/model/tfjs_model');
}


main().catch(err => console.error(err));
