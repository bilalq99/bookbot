def main():
    book_path= "books/frankenstein.txt"
    text =get_book_text(book_path)
    print(text)
def get_book_text(path):
    with open(path) as f: 
        return f.read()
    
def countWords():
    book_path= "books/frankenstein.txt"
    text =get_book_text(book_path)
    words=text.split()
    new1= len(words)
    print(new1)
def countLetters():
    book_path= "books/frankenstein.txt"
    text =get_book_text(book_path)
    words=text
    dictionary1={}
    for word in words:
        word=word.lower()
        if word.isalpha():
            dictionary1[word]=dictionary1.get(word,0)+1
    print(dictionary1)
def report():
    book_path= "books/frankenstein.txt"
    text =get_book_text(book_path)
    words=text
    dictionary1={}
    for word in words:
        word=word.lower()
        if word.isalpha():
            dictionary1[word]=dictionary1.get(word,0)+1
    sorted_chars = sorted(dictionary1.keys())
    print(f"--- Begin report of {book_path} ---")
    print(f"{len(words)} words found in the document\n")
    for char in sorted_chars:
        print(f"The '{char}' character was found {dictionary1[char]} times")
    print("--- End report ---")
        

report()
#countLetters()
#main()
#countWords()
