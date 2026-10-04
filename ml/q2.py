file_path="forest.txt"
file=open(file_path,'r')
content=file.read().split()
data={}
for i in content:
    key=i
    value=0
    if i in data.keys():
        value=data[i]+1
        data[key]=value
        continue
    value=value+1
    data[key]=value
print(f"The Total number of words in files is {len(content)}")
print(data)

file.close()