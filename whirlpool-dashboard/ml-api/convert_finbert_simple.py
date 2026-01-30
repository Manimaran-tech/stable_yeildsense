import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

def convert_finbert_simple():
    model_dir = "models/finbert_sentiment"
    onnx_path = "models/onnx/finbert.onnx"
    
    print(f"Loading model from {model_dir}...")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()
    
    # Use a fixed sequence length of 128 for easier conversion
    dummy_input = tokenizer("dummy text", return_tensors="pt", padding="max_length", max_length=128)
    
    print(f"Exporting to {onnx_path}...")
    torch.onnx.export(
        model,
        (dummy_input['input_ids'], dummy_input['attention_mask']),
        onnx_path,
        input_names=['input_ids', 'attention_mask'],
        output_names=['logits'],
        opset_version=14, # Try opset 14
        do_constant_folding=True
    )
    print("Export successful!")

if __name__ == "__main__":
    try:
        convert_finbert_simple()
    except Exception as e:
        print(f"Error: {e}")
