import os
import tensorflow as tf
import tf2onnx
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

def convert_keras_to_onnx(model_path, onnx_path):
    print(f"Converting {model_path} to {onnx_path}...")
    model = tf.keras.models.load_model(model_path, compile=False)
    
    # Define input signature based on expected [1, 30, 3] shape
    spec = (tf.TensorSpec((None, 30, 3), tf.float32, name="input"),)
    
    model_proto, _ = tf2onnx.convert.from_keras(model, input_signature=spec, opset=13)
    onnx.save(model_proto, onnx_path)
    print(f"Successfully converted {model_path}")

def convert_finbert_to_onnx(model_dir, onnx_path):
    print(f"Converting FinBERT from {model_dir} to {onnx_path}...")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()
    
    dummy_input = tokenizer("dummy text", return_tensors="pt")
    
    torch.onnx.export(
        model,
        (dummy_input['input_ids'], dummy_input['attention_mask']),
        onnx_path,
        input_names=['input_ids', 'attention_mask'],
        output_names=['logits'],
        dynamic_axes={
            'input_ids': {0: 'batch_size', 1: 'sequence_length'},
            'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
            'logits': {0: 'batch_size'}
        },
        opset_version=13
    )
    
    # Apply dynamic quantization to FinBERT (INT8)
    quantized_path = onnx_path.replace(".onnx", "_quant.onnx")
    quantize_dynamic(onnx_path, quantized_path, weight_type=QuantType.QInt8)
    print(f"Successfully converted and quantized FinBERT to {quantized_path}")

if __name__ == "__main__":
    models_dir = "models"
    output_dir = "models/onnx"
    os.makedirs(output_dir, exist_ok=True)
    
    tokens = ['sol', 'jup', 'jupsol', 'pengu', 'usdt', 'usdc']
    
    for token in tokens:
        keras_path = os.path.join(models_dir, f"volatility_{token}.keras")
        if os.path.exists(keras_path):
            onnx_path = os.path.join(output_dir, f"volatility_{token}.onnx")
            try:
                convert_keras_to_onnx(keras_path, onnx_path)
            except Exception as e:
                print(f"Error converting {token}: {e}")
                
    finbert_dir = os.path.join(models_dir, "finbert_sentiment")
    if os.path.exists(finbert_dir):
        finbert_onnx = os.path.join(output_dir, "finbert.onnx")
        try:
            convert_finbert_to_onnx(finbert_dir, finbert_onnx)
        except Exception as e:
            print(f"Error converting FinBERT: {e}")
